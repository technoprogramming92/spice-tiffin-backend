// routes/customer.route.ts
import { Router } from "express";
import {
  getMyProfile,
  updateMyProfile,
} from "../controllers/customer.controller.js";
import { protect } from "../middlewares/authMiddleware.js"; // Import the auth middleware
import { catchAsync } from "../utils/catchAsync.js"; // Assuming you have this utility

const router = Router();

// @route   GET /api/v1/customer/profile
// @desc    Get logged-in customer's profile
// @access  Private
// --- ADD 'protect' middleware directly here ---
router.get(
  "/profile",
  protect, // Apply middleware before the controller
  catchAsync(getMyProfile)
);

// @route   PUT /api/v1/customer/profile
// @desc    Update logged-in customer's profile
// @access  Private
// --- ADD 'protect' middleware directly here ---
router.put(
  "/profile",
  protect, // Apply middleware before the controller
  catchAsync(updateMyProfile)
);

// You could also use PATCH for partial updates, PUT often implies replacing the resource (though commonly used for updates too)
router.patch("/profile", catchAsync(updateMyProfile));

export default router;
