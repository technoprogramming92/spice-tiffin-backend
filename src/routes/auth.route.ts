// Purpose: Authentication routes including registration
import { Router } from "express";
import {
  register,
  login,
  verifyOTP,
  requestPasswordResetController,
  verifyPasswordResetOtpController,
  resetPasswordController,
} from "../controllers/auth.controller.js";
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

router.post("/register", catchAsync(register));
router.post("/login", catchAsync(login));
router.post("/verify-otp", catchAsync(verifyOTP));

/** Request OTP */
router.post(
  "/request-password-reset",
  catchAsync(requestPasswordResetController)
);

/** Verify OTP & Get Reset Token */
router.post("/verify-reset-otp", catchAsync(verifyPasswordResetOtpController));

/** Reset Password using Token */
router.post("/reset-password", catchAsync(resetPasswordController));

export default router;
