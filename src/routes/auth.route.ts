// Purpose: Authentication routes including registration
import { Router } from "express";
import { register, login, verifyOTP } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyOTP);

export default router;
