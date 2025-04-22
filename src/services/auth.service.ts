// Purpose: Business logic to handle customer registration
import bcrypt from "bcryptjs";
import { Customer } from "../models/Customer.model.js";
import axios from "axios";
import { RegisterInput } from "../validators/authSchema.js";
import jwt from "jsonwebtoken";
import { stripe } from "../utils/stripe.js";

const generateToken = (userId: string) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from .env");
  }

  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const registerCustomer = async (data: RegisterInput) => {
  const { fullName, email, mobile, password } = data;

  // Check for existing user
  const existingUser = await Customer.findOne({
    $or: [{ email }, { mobile }],
  });

  if (existingUser) {
    throw new Error("Email or mobile number already in use");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  const stripeCustomer = await stripe.customers.create({
    name: fullName,
    email,
    phone: mobile,
    metadata: {
      platformUserId: "generated after Mongo save",
    },
  });

  // Create user
  const newCustomer = await Customer.create({
    fullName,
    email,
    mobile,
    password: hashedPassword,
    stripeCustomerId: stripeCustomer.id,
    verification: false,
    otpSessionId: undefined,
    address: "",
    city: "",
    postalCode: "",
    currentLocation: "",
  });

  await stripe.customers.update(stripeCustomer.id, {
    metadata: { platformUserId: newCustomer._id.toString() },
  });

  return newCustomer._id;
};

export const handleMobileLogin = async (mobile: string, password: string) => {
  const user = await Customer.findOne({ mobile });

  if (!user) throw new Error("Mobile number not registered");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid password");

  // If user is verified, return token
  if (user.verification) {
    const token = generateToken(user._id.toString());
    return { verificationRequired: false, token };
  }

  if (!process.env.TWO_FACTOR_API || !process.env.TWO_FACTOR_TEMPLATE_NAME) {
    throw new Error("2Factor API Key or Template Name is missing.");
  }

  // Generate 4-digit OTP
  const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
  const formattedMobile = mobile.replace("+", "");

  const { data } = await axios.get(
    `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API}/SMS/${formattedMobile}/${otpCode}/${process.env.TWO_FACTOR_TEMPLATE_NAME}`
  );

  if (data.Status !== "Success") {
    throw new Error(`OTP failed to send: ${data.Details}`);
  }

  // Save OTP in user DB (valid for 5 mins)
  user.otpCode = otpCode;
  user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await user.save();

  return { verificationRequired: true };
};

export const verifyOTPAndLogin = async (mobile: string, otp: string) => {
  const user = await Customer.findOne({ mobile });

  if (!user || !user.otpCode || !user.otpExpiresAt) {
    throw new Error("OTP session not found or expired");
  }

  if (user.otpCode !== otp) {
    throw new Error("Invalid OTP");
  }

  if (user.otpExpiresAt < new Date()) {
    throw new Error("OTP has expired");
  }

  // Mark user as verified
  user.verification = true;
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  // Generate JWT
  const token = generateToken(user._id.toString());

  return { token };
};
