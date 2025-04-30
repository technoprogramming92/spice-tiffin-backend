// src/routes/addon-order.route.ts
import { Router } from "express";
import { initiateAddonOrderPayment } from "../controllers/addon-order.controller.js";
import { protect } from "../middlewares/authMiddleware.js"; // Customer auth
import { catchAsync } from "../utils/catchAsync.js"; // Use if you have this utility

const router = Router();

/**
 * @route   POST /api/v1/addon-orders/initiate-payment
 * @desc    Creates Stripe Payment Intent and preliminary AddonOrder
 * @access  Private (Customer)
 */
router.post(
  "/initiate-payment", // You might want to remove this path segment if mounting router at /initiate-payment
  protect,
  catchAsync(initiateAddonOrderPayment) // Use catchAsync if available
  // If not using catchAsync, wrap controller directly: initiateAddonOrderPayment
);

// Add other routes later if needed

export default router;
