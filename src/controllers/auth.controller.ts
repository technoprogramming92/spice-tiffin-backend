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
