import { Request, Response, NextFunction } from "express";
import {
  loginSchema,
  otpVerifySchema,
  registerSchema,
} from "../validators/authSchema.js";
import {
  handleMobileLogin,
  verifyOTPAndLogin,
  registerCustomer,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithToken,
} from "../services/auth.service.js";

// 🚀 Registration Controller (still the same)
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.flatten(),
      });
    }

    const userId = await registerCustomer(parsed.data);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { userId },
    });
  } catch (err) {
    next(err);
  }
};

// 🔐 Login with Mobile + Password
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.flatten(),
      });
    }

    const { mobile, password } = parsed.data;
    const result = await handleMobileLogin(mobile, password);

    if (result.verificationRequired) {
      return res.status(200).json({
        success: false,
        message: "OTP sent to registered number",
        verificationRequired: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: result.token,
    });
  } catch (err) {
    next(err);
  }
};

// 🔁 OTP Verification & Final Login
export const verifyOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = otpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.flatten(),
      });
    }

    const { mobile, otp } = parsed.data;
    const result = await verifyOTPAndLogin(mobile, otp);

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token: result.token,
    });
  } catch (err) {
    next(err);
  }
};

/** Controller for Step 1: Request Reset OTP */
export const requestPasswordResetController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res
      .status(400)
      .json({ success: false, message: "Phone number is required." });
  }
  try {
    const result = await requestPasswordResetOtp(phoneNumber);
    // Always return 200 OK with the generic message from the service for security
    res.status(200).json(result);
  } catch (error) {
    next(error); // Pass error to global handler
  }
};

/** Controller for Step 2: Verify Reset OTP */
export const verifyPasswordResetOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { phoneNumber, otp } = req.body;
  if (!phoneNumber || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "Phone number and OTP are required." });
  }
  // Add basic OTP format check if needed
  if (typeof otp !== "string" || !/^\d{4}$/.test(otp)) {
    // Check for 4 digits
    return res.status(400).json({
      success: false,
      message: "Invalid OTP format. Please enter 4 digits.",
    });
  }

  try {
    const result = await verifyPasswordResetOtp(phoneNumber, otp);
    // Service returns { success, message, resetToken? }
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/** Controller for Step 3: Reset Password */
export const resetPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { phoneNumber, resetToken, newPassword, confirmPassword } = req.body;

  // Basic Validation
  if (!resetToken)
    return res
      .status(400)
      .json({ success: false, message: "Reset token is required." });
  if (!newPassword)
    return res
      .status(400)
      .json({ success: false, message: "New password is required." });
  if (newPassword.length < 8)
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters.",
    }); // Example length check
  if (newPassword !== confirmPassword)
    return res
      .status(400)
      .json({ success: false, message: "Passwords do not match." });

  try {
    const result = await resetPasswordWithToken(
      phoneNumber,
      resetToken,
      newPassword
    );
    // Service returns { success, message }
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
