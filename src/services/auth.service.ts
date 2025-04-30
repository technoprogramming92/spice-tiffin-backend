// src/services/auth.service.ts
import bcrypt from "bcryptjs"; // Use bcryptjs consistently as imported
import { Customer, ICustomer } from "../models/Customer.model.js";
// Assuming RegisterInput type is defined elsewhere if needed by other functions
// import type { RegisterInput } from "../validators/authSchema.js";
import jwt from "jsonwebtoken";
import { stripe } from "../utils/stripe.js"; // Assuming stripe setup exists
import twilio from "twilio"; // Import twilio
import crypto from "crypto"; // Import crypto for final reset token
import { customerService } from "./customer.service.js"; // Import CustomerService instance

// --- Constants ---
const SALT_ROUNDS = 10; // Define salt rounds (consider moving to config)
const OTP_LENGTH = 4; // Or 6, should match Twilio Verify settings if applicable
const RESET_TOKEN_EXPIRY_HOURS = 1; // Expiry for the final reset token

// --- Twilio Setup ---
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

if (!accountSid || !authToken || !verifyServiceSid) {
  console.error("FATAL ERROR: Missing Twilio credentials.");
  // Optional: throw new Error("Twilio configuration missing.");
}
const twilioClient =
  accountSid && authToken ? twilio(accountSid, authToken) : null;
// --- End Twilio Setup ---

// --- Helper Functions ---

/** Generates JWT */
const generateToken = (userId: string): string => {
  if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not set.");
    throw new Error("Server configuration error [J1].");
  }
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

/** Generate a secure random token and its hash */
async function generateSecureToken(): Promise<{
  plainToken: string;
  hashedToken: string;
}> {
  const plainToken = crypto.randomBytes(32).toString("hex");
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedToken = await bcrypt.hash(plainToken, salt);
  return { plainToken, hashedToken };
}

/** Helper to format phone number for Twilio */
const formatPhoneNumberForTwilio = (phoneNumber: string): string => {
  let formattedMobile = phoneNumber.trim();
  if (!formattedMobile.startsWith("+")) {
    // Basic assumption - make this more robust if handling many international codes
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
        `[AuthService] Cannot reliably determine country code for ${phoneNumber}. Consider requiring E.164 format.`
      );
  }
  return formattedMobile;
};

// --- Service Functions ---

/** Customer Registration */
export const registerCustomer = async (
  // Expect the raw data structure, validation happens in controller/middleware
  data: { fullName: string; email: string; mobile: string; password: string }
): Promise<string> => {
  const { fullName, email, mobile, password } = data;
  console.log(`[AuthService] Registering customer: ${email}, ${mobile}`);

  // Check existing user
  const existingUser = await Customer.findOne({ $or: [{ email }, { mobile }] });
  if (existingUser) {
    const conflictField =
      existingUser.email === email ? "Email" : "Mobile number";
    console.warn(
      `[AuthService] Registration failed: ${conflictField} already in use.`
    );
    throw new Error(`${conflictField} already in use.`); // Let controller handle status code
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); // Use SALT_ROUNDS

  // Create Stripe Customer
  let stripeCustomerId: string | undefined;
  try {
    const stripeCustomer = await stripe.customers.create({
      name: fullName,
      email,
      phone: mobile,
    });
    stripeCustomerId = stripeCustomer.id;
    console.log(`[AuthService] Stripe customer created: ${stripeCustomerId}`);
  } catch (stripeError: any) {
    console.error("[AuthService] Error creating Stripe customer:", stripeError);
    throw new Error(
      `Failed to create payment profile: ${stripeError.message || "Unknown Stripe error"}`
    );
  }

  // Create customer in DB
  const newCustomerData = {
    fullName,
    email,
    mobile,
    password: hashedPassword,
    stripeCustomerId: stripeCustomerId,
    verification: false, // Default to false
    // Ensure default empty strings match model or use undefined
    address: "",
    city: "",
    postalCode: "",
    currentLocation: "",
  };
  const newCustomer = await Customer.create(newCustomerData); // No need to cast if types align
  console.log(`[AuthService] Customer created in DB: ${newCustomer.id}`); // Use .id

  // Update Stripe metadata
  try {
    await stripe.customers.update(stripeCustomerId!, {
      // Use non-null assertion
      metadata: { platformUserId: newCustomer.id.toString() },
    });
    console.log(`[AuthService] Stripe customer metadata updated.`);
  } catch (stripeUpdateError: any) {
    console.error(
      "[AuthService] Error updating Stripe customer metadata:",
      stripeUpdateError
    );
    // Log and continue
  }

  return newCustomer.id.toString(); // Use .id
};

/** Handle Mobile Login Attempt (incl. initiating verification) */
export const handleMobileLogin = async (
  mobile: string,
  password: string
): Promise<{ verificationRequired: boolean; token?: string }> => {
  console.log(`[AuthService] Login attempt for mobile: ${mobile}`);
  // Fetch user WITH password field selected
  const user = await Customer.findOne({ mobile }).select("+password");

  if (!user) {
    console.warn(
      `[AuthService] Login failed: Mobile ${mobile} not registered.`
    );
    throw new Error("Invalid credentials."); // Generic message
  }

  // User exists, compare password
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    console.warn(
      `[AuthService] Login failed: Invalid password for mobile ${mobile}.`
    );
    throw new Error("Invalid credentials."); // Generic message
  }

  // Password matches. Check verification status.
  if (user.verification) {
    console.log(`[AuthService] User ${user.id} verified. Generating token.`);
    const token = generateToken(user.id.toString()); // Use .id
    return { verificationRequired: false, token };
  }

  // --- User Not Verified - Initiate Twilio Verification ---
  console.log(
    `[AuthService] User ${user.id} not verified. Initiating Twilio verification.`
  );
  if (!twilioClient || !verifyServiceSid) {
    console.error("[AuthService] Twilio client/Verify SID missing.");
    throw new Error("OTP service is currently unavailable [T3].");
  }

  try {
    const formattedMobile = formatPhoneNumberForTwilio(user.mobile!); // Use user's stored mobile
    console.log(
      `[AuthService] Sending Twilio verification to: ${formattedMobile}`
    );
    const verification = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: formattedMobile, channel: "sms" });
    console.log(
      `[AuthService] Twilio verification status: ${verification.status}`
    );
    return { verificationRequired: true }; // Inform controller OTP was sent
  } catch (twilioError: any) {
    console.error(
      `[AuthService] Error sending Twilio verification for ${mobile}:`,
      twilioError
    );
    // Handle specific Twilio errors if needed (like invalid number)
    if (twilioError?.code === 60200 || twilioError?.code === 21211) {
      throw new Error("Invalid phone number format for OTP.");
    }
    throw new Error(
      `Failed to send OTP. Please try again later. [${twilioError.message || "Twilio Error"}]`
    );
  }
};

/** Verify OTP (from initial login/signup) and Login */
export const verifyOTPAndLogin = async (
  mobile: string,
  otp: string
): Promise<{ token: string }> => {
  console.log(`[AuthService] Verifying OTP ${otp} for mobile: ${mobile}`);
  if (!twilioClient || !verifyServiceSid) {
    console.error("[AuthService] Twilio client/Verify SID missing.");
    throw new Error("OTP service is currently unavailable [T4].");
  }

  // Find user first to ensure account exists for this number
  const user = await Customer.findOne({ mobile });
  if (!user) {
    console.warn(
      `[AuthService] Cannot verify OTP, user not found for mobile: ${mobile}`
    );
    throw new Error("Invalid mobile number or OTP code."); // Generic error
  }

  try {
    const formattedMobile = formatPhoneNumberForTwilio(user.mobile!);
    console.log(
      `[AuthService] Checking Twilio verification for: ${formattedMobile}`
    );
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: formattedMobile, code: otp });
    console.log(
      `[AuthService] Twilio check status: ${verificationCheck.status}`
    );

    if (verificationCheck.status === "approved") {
      console.log(
        `[AuthService] OTP approved for ${mobile}. User ID: ${user.id}`
      );
      // Mark user as verified in DB (if not already)
      if (!user.verification) {
        user.verification = true;
        await user.save();
        console.log(`[AuthService] User ${user.id} marked as verified.`);
      }
      // Generate JWT
      const token = generateToken(user.id.toString());
      console.log(`[AuthService] JWT generated for user ${user.id}.`);
      return { token };
    } else {
      console.warn(
        `[AuthService] OTP check failed for ${mobile}. Status: ${verificationCheck.status}`
      );
      throw new Error("Invalid or expired OTP code.");
    }
  } catch (twilioError: any) {
    console.error(
      `[AuthService] Error checking Twilio verification for ${mobile}:`,
      twilioError
    );
    if (
      twilioError?.code === 20404 ||
      (twilioError instanceof Error &&
        twilioError.message.includes("not found"))
    ) {
      throw new Error(
        "OTP code not found or expired. Please try logging in again."
      );
    }
    throw new Error(
      `Failed to verify OTP. [${twilioError.message || "Twilio Error"}]`
    );
  }
};

// --- Password Reset Functions ---

/** Step 1: Request password reset OTP via Twilio Verify SMS */
export const requestPasswordResetOtp = async (
  phoneNumber: string
): Promise<{ success: boolean; message: string }> => {
  console.log(
    `[AuthService] Password reset requested for phone: ${phoneNumber}`
  );
  if (!twilioClient || !verifyServiceSid) {
    console.error(
      "[AuthService] Twilio client/Verify SID missing for password reset."
    );
    throw new Error("Password reset service is temporarily unavailable [T1].");
  }

  try {
    // Use CustomerService now
    const customer = await customerService.findByPhoneNumber(phoneNumber);
    if (customer) {
      console.log(
        `[AuthService] Customer found for password reset request: ${customer.id}`
      );
      const formattedMobile = formatPhoneNumberForTwilio(customer.mobile!);
      console.log(
        `[AuthService] Sending Twilio verification for password reset to: ${formattedMobile}`
      );
      const verification = await twilioClient.verify.v2
        .services(verifyServiceSid)
        .verifications.create({ to: formattedMobile, channel: "sms" });
      console.log(
        `[AuthService] Twilio verification status for ${formattedMobile}: ${verification.status}`
      );
    } else {
      console.log(
        `[AuthService] No customer found for phone: ${phoneNumber} during password reset request.`
      );
    }
    return {
      success: true,
      message: "If an account exists, an OTP has been sent.",
    };
  } catch (error: any) {
    console.error("[AuthService] Error requesting password reset OTP:", error);
    if (error?.code === 60200 || error?.code === 21211) {
      throw new Error("Invalid phone number format provided.");
    }
    throw new Error(
      `Could not send reset code. Please try again later. [${error.message || "SMS Error"}]`
    );
  }
};

/** Step 2: Verify password reset OTP and issue final reset token */
export const verifyPasswordResetOtp = async (
  phoneNumber: string,
  otp: string
): Promise<{ success: boolean; message: string; resetToken?: string }> => {
  console.log(
    `[AuthService] Verifying password reset OTP ${otp} for mobile: ${phoneNumber}`
  );
  if (!twilioClient || !verifyServiceSid) {
    /* ... handle missing Twilio ... */ throw new Error(
      "Service unavailable [T2]."
    );
  }

  const customer = await customerService.findByPhoneNumber(phoneNumber);
  if (!customer) {
    /* ... handle not found ... */ throw new Error(
      "Invalid phone number or OTP."
    );
  }

  try {
    const formattedMobile = formatPhoneNumberForTwilio(customer.mobile!);
    console.log(
      `[AuthService] Checking Twilio verification for password reset: ${formattedMobile}`
    );
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: formattedMobile, code: otp });
    console.log(
      `[AuthService] Twilio check status: ${verificationCheck.status}`
    );

    if (verificationCheck.status === "approved") {
      console.log(
        `[AuthService] Pwd reset OTP approved for ${phoneNumber}, User ID: ${customer.id}`
      );
      const { plainToken, hashedToken } = await generateSecureToken(); // Use await
      const tokenExpires = new Date(
        Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
      );
      // Use CustomerService to set fields, then save
      customerService.setFinalResetTokenFields(
        customer,
        hashedToken,
        tokenExpires
      ); // Use await if needed
      await customer.save();
      console.log(
        `[AuthService] Final password reset token saved for user ${customer.id}`
      );
      return {
        success: true,
        message: "OTP verified.",
        resetToken: plainToken,
      };
    } else {
      console.warn(
        `[AuthService] Pwd reset OTP check failed for ${phoneNumber}. Status: ${verificationCheck.status}`
      );
      throw new Error("Invalid or expired OTP code.");
    }
  } catch (error: any) {
    console.error(
      `[AuthService] Error checking Twilio verification for ${phoneNumber}:`,
      error
    );
    if (
      error?.code === 20404 ||
      (error instanceof Error && error.message.includes("not found"))
    ) {
      throw new Error(
        "OTP code not found or expired. Please request a new one."
      );
    }
    throw new Error(
      `Failed to verify OTP. [${error.message || "Twilio Error"}]`
    );
  }
};

/** Step 3: Reset password using the final token */
export const resetPasswordWithToken = async (
  phoneNumber: string,
  resetToken: string,
  newPasswordClear: string
): Promise<{ success: boolean; message: string }> => {
  console.log(
    `[AuthService] Attempting password reset for phone ${phoneNumber} with token.`
  );
  if (!resetToken) throw new Error("Reset token is required.");
  if (!phoneNumber) throw new Error("Phone number is required.");

  // 1. Find user by phone number
  const customer = await customerService.findByPhoneNumber(phoneNumber); // Service selects needed fields

  // 2. Validate user and token fields
  if (
    !customer ||
    !customer.passwordResetTokenHash ||
    !customer.passwordResetTokenExpires
  ) {
    console.warn(
      `[AuthService] No user or valid token found for reset via phone ${phoneNumber}.`
    );
    throw new Error(
      "Password reset link is invalid or has expired (user/token data missing)."
    );
  }

  // 3. Check token expiry
  if (customer.passwordResetTokenExpires < new Date()) {
    console.log(`[AuthService] Reset token expired for user ${customer.id}.`);
    // Clear expired token fields
    customer.passwordResetTokenHash = null;
    customer.passwordResetTokenExpires = null;
    await customer.save();
    throw new Error("Password reset link is invalid or has expired.");
  }

  // 4. Compare the PLAIN token from request with the STORED HASH
  const isTokenMatch = await bcrypt.compare(
    resetToken,
    customer.passwordResetTokenHash
  );

  if (!isTokenMatch) {
    console.warn(
      `[AuthService] Reset token comparison failed for user ${customer.id}.`
    );
    // Security: Optionally clear the token fields even on mismatch?
    // customer.passwordResetTokenHash = null;
    // customer.passwordResetTokenExpires = null;
    // await customer.save();
    throw new Error(
      "Password reset link is invalid or has expired (token mismatch)."
    );
  }

  // --- Token is VALID ---
  console.log(
    `[AuthService] Reset token validated for user ${customer.id}. Updating password.`
  );
  try {
    // Update password (service handles hashing and clearing tokens)
    await customerService.updatePassword(
      customer.id.toString(),
      newPasswordClear
    );
    return {
      success: true,
      message: "Password has been reset successfully. Please log in.",
    };
  } catch (error: any) {
    console.error(
      `[AuthService] Failed to update password for user ${customer.id}:`,
      error
    );
    throw new Error(
      `Failed to update password: ${error.message || "Database error"}`
    );
  }
};
