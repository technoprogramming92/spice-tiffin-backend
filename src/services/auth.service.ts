// src/services/auth.service.ts
import bcrypt from "bcryptjs";
import { Customer, ICustomer } from "../models/Customer.model.js";
import type { RegisterInput } from "../validators/authSchema.js"; // Assuming path is correct
import jwt from "jsonwebtoken";
import { stripe } from "../utils/stripe.js";
import twilio from "twilio"; // Import twilio

// --- Twilio Setup ---
// Ensure required Twilio environment variables are present
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// Basic check during initialization
if (!accountSid || !authToken || !verifyServiceSid) {
  console.error(
    "FATAL ERROR: Missing Twilio credentials in environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID)."
  );
  // Optionally throw an error to prevent startup without credentials
  // throw new Error("Twilio configuration missing.");
}

// Initialize Twilio client (only if credentials exist)
const twilioClient =
  accountSid && authToken ? twilio(accountSid, authToken) : null;
// --- End Twilio Setup ---

// --- JWT Generation (Keep existing) ---
const generateToken = (userId: string): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from .env");
  }
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// --- Registration (Keep mostly existing, remove OTP fields) ---
export const registerCustomer = async (
  data: RegisterInput
): Promise<string> => {
  const { fullName, email, mobile, password } = data;

  console.log(`[AuthService] Registering customer: ${email}, ${mobile}`);
  const existingUser = await Customer.findOne({ $or: [{ email }, { mobile }] });
  if (existingUser) {
    // Be specific about which field conflicts
    const conflictField =
      existingUser.email === email ? "Email" : "Mobile number";
    console.warn(
      `[AuthService] Registration failed: ${conflictField} already in use.`
    );
    throw new Error(`${conflictField} already in use.`);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Create Stripe Customer first
  let stripeCustomerId: string | undefined;
  try {
    const stripeCustomer = await stripe.customers.create({
      name: fullName,
      email,
      phone: mobile,
      // Metadata added later after customer save
    });
    stripeCustomerId = stripeCustomer.id;
    console.log(`[AuthService] Stripe customer created: ${stripeCustomerId}`);
  } catch (stripeError) {
    console.error("[AuthService] Error creating Stripe customer:", stripeError);
    // Decide how to handle Stripe errors - fail registration or proceed without Stripe ID?
    // Let's fail for now:
    throw new Error(
      `Failed to create payment profile: ${stripeError instanceof Error ? stripeError.message : "Unknown Stripe error"}`
    );
  }

  // Create user in DB
  const newCustomerData = {
    fullName,
    email,
    mobile,
    password: hashedPassword,
    stripeCustomerId: stripeCustomerId,
    verification: false, // Start as unverified
    // Removed OTP fields
    address: "",
    city: "",
    postalCode: "",
    currentLocation: "",
  };
  const newCustomer = (await Customer.create(newCustomerData)) as ICustomer;
  console.log(`[AuthService] Customer created in DB: ${newCustomer._id}`);

  // Update Stripe customer metadata with DB ID
  try {
    await stripe.customers.update(stripeCustomerId!, {
      // Use non-null assertion as we check above
      metadata: { platformUserId: newCustomer._id.toString() },
    });
    console.log(`[AuthService] Stripe customer metadata updated.`);
  } catch (stripeUpdateError) {
    console.error(
      "[AuthService] Error updating Stripe customer metadata:",
      stripeUpdateError
    );
    // Log error but don't necessarily fail registration at this point
  }

  return newCustomer._id.toString();
};

// --- Login Handler (Updated for Twilio Verify) ---
export const handleMobileLogin = async (
  mobile: string,
  password: string
): Promise<{ verificationRequired: boolean; token?: string }> => {
  console.log(`[AuthService] Login attempt for mobile: ${mobile}`);
  const user = await Customer.findOne({ mobile });

  if (!user) {
    console.warn(
      `[AuthService] Login failed: Mobile number ${mobile} not registered.`
    );
    throw new Error("Mobile number not registered");
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    console.warn(
      `[AuthService] Login failed: Invalid password for mobile ${mobile}.`
    );
    throw new Error("Invalid password");
  }

  // If user is already verified, generate and return token directly
  if (user.verification) {
    console.log(
      `[AuthService] User ${user._id} already verified. Generating token.`
    );
    const token = generateToken(user._id.toString());
    return { verificationRequired: false, token };
  }

  // --- User is NOT verified, initiate Twilio Verification ---
  console.log(
    `[AuthService] User ${user._id} not verified. Initiating Twilio verification.`
  );

  // Check if Twilio client was initialized
  if (!twilioClient || !verifyServiceSid) {
    console.error(
      "[AuthService] Twilio client or Verify Service SID not available. Check environment variables."
    );
    throw new Error(
      "OTP service is currently unavailable. Please try again later."
    );
  }

  try {
    // Format number for Twilio (needs E.164 format, e.g., +1XXXXXXXXXX, +91XXXXXXXXXX)
    // Assuming input 'mobile' might or might not have '+'. Add '+' if missing for common cases.
    // IMPORTANT: This assumes Canadian/US (+1) or Indian (+91) format primarily.
    // Robust international formatting might need a library like libphonenumber-js.
    let formattedMobile = mobile.trim();
    if (!formattedMobile.startsWith("+")) {
      // Basic assumption - adjust if needed based on how numbers are stored/entered
      if (
        formattedMobile.length === 10 &&
        (process.env.DEFAULT_COUNTRY_CODE === "CA" ||
          process.env.DEFAULT_COUNTRY_CODE === "US")
      ) {
        formattedMobile = `+1${formattedMobile}`;
      } else if (
        formattedMobile.length === 10 &&
        process.env.DEFAULT_COUNTRY_CODE === "IN"
      ) {
        formattedMobile = `+91${formattedMobile}`;
      } else {
        // Cannot determine country code - might fail
        console.warn(
          `[AuthService] Cannot determine country code for mobile ${mobile}. Attempting without explicit '+'`
        );
        // Twilio might handle it, or might fail. Consider requiring E.164 format during registration.
      }
    }
    console.log(
      `[AuthService] Sending Twilio verification to: ${formattedMobile}`
    );

    // Send OTP via Twilio Verify
    const verification = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: formattedMobile, channel: "sms" }); // Use 'sms' channel

    console.log(
      `[AuthService] Twilio verification status for ${formattedMobile}: ${verification.status}`
    );
    // Twilio handles sending and managing the code. We don't store it.

    // Respond to controller indicating OTP was sent
    return { verificationRequired: true };
  } catch (twilioError) {
    console.error(
      `[AuthService] Error sending Twilio verification for ${mobile}:`,
      twilioError
    );
    // Provide a user-friendly error
    throw new Error(
      `Failed to send OTP. Please check the mobile number or try again later. [${twilioError instanceof Error ? twilioError.message : "Twilio Error"}]`
    );
  }
};

// --- OTP Verification Handler (Updated for Twilio Verify) ---
export const verifyOTPAndLogin = async (
  mobile: string,
  otp: string
): Promise<{ token: string }> => {
  console.log(`[AuthService] Verifying OTP ${otp} for mobile: ${mobile}`);

  // Check if Twilio client was initialized
  if (!twilioClient || !verifyServiceSid) {
    console.error(
      "[AuthService] Twilio client or Verify Service SID not available."
    );
    throw new Error("OTP service is currently unavailable.");
  }

  try {
    // Format number for Twilio (same logic as sending)
    let formattedMobile = mobile.trim();
    if (!formattedMobile.startsWith("+")) {
      // Basic assumption based on potential default country code
      if (
        formattedMobile.length === 10 &&
        (process.env.DEFAULT_COUNTRY_CODE === "CA" ||
          process.env.DEFAULT_COUNTRY_CODE === "US")
      )
        formattedMobile = `+1${formattedMobile}`;
      else if (
        formattedMobile.length === 10 &&
        process.env.DEFAULT_COUNTRY_CODE === "IN"
      )
        formattedMobile = `+91${formattedMobile}`;
      else
        console.warn(
          `[AuthService] Cannot determine country code for OTP check for ${mobile}.`
        );
    }
    console.log(
      `[AuthService] Checking Twilio verification for: ${formattedMobile}`
    );

    // Check the OTP with Twilio Verify
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: formattedMobile, code: otp });

    console.log(
      `[AuthService] Twilio verification check status for ${formattedMobile}: ${verificationCheck.status}`
    );

    // Check if the verification was successful ('approved')
    if (verificationCheck.status === "approved") {
      console.log(
        `[AuthService] OTP approved for ${mobile}. Marking user as verified.`
      );

      // Find user again (ensure they exist)
      const user = await Customer.findOne({ mobile });
      if (!user) {
        // Should not happen if login initiated OTP, but check anyway
        console.error(
          `[AuthService] User ${mobile} not found during OTP verification success.`
        );
        throw new Error("User not found after successful OTP verification.");
      }

      // Mark user as verified in DB (if not already)
      if (!user.verification) {
        user.verification = true;
        await user.save();
        console.log(`[AuthService] User ${user._id} marked as verified.`);
      }

      // Generate JWT
      const token = generateToken(user._id.toString());
      console.log(`[AuthService] JWT generated for user ${user._id}.`);
      return { token };
    } else {
      // Verification failed (pending, canceled, max_attempts_reached)
      console.warn(
        `[AuthService] OTP verification failed for ${mobile}. Status: ${verificationCheck.status}`
      );
      throw new Error("Invalid or expired OTP code.");
    }
  } catch (twilioError) {
    console.error(
      `[AuthService] Error checking Twilio verification for ${mobile}:`,
      twilioError
    );
    // Handle potential Twilio errors (e.g., "VerificationCheck resource not found" if code expired or never sent)
    if (
      twilioError instanceof Error &&
      twilioError.message.includes("not found")
    ) {
      throw new Error(
        "OTP code not found or expired. Please try logging in again."
      );
    }
    throw new Error(
      `Failed to verify OTP. [${twilioError instanceof Error ? twilioError.message : "Twilio Error"}]`
    );
  }
};
