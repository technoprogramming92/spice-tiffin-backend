// routes/customer.route.ts
import { Router } from "express";
import {
  getMyProfile,
  updateMyProfile,
} from "../controllers/customer.controller.js";
import { protect } from "../middlewares/authMiddleware.js"; // Import the auth middleware
import { catchAsync } from "../utils/catchAsync.js"; // Assuming you have this utility

const router = Router();

// Apply the 'protect' middleware to all routes in this file
router.use(protect);

// @route   GET /api/v1/customer/profile
// @desc    Get logged-in customer's profile
// @access  Private
router.get("/profile", catchAsync(getMyProfile));

// @route   PUT /api/v1/customer/profile
// @desc    Update logged-in customer's profile
// @access  Private
router.put("/profile", catchAsync(updateMyProfile));

// You could also use PATCH for partial updates, PUT often implies replacing the resource (though commonly used for updates too)
router.patch("/profile", catchAsync(updateMyProfile));

export default router;
