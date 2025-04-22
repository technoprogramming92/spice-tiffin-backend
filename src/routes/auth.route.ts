// Purpose: Authentication routes including registration
import { Router } from "express";
import { register, login, verifyOTP } from "../controllers/auth.controller.js";
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

router.post("/register", catchAsync(register));
router.post("/login", catchAsync(login));
router.post("/verify-otp", catchAsync(verifyOTP));

export default router;
