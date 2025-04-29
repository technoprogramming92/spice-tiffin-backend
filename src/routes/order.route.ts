// routes/order.route.ts
import { Router } from "express";
import {
  getMyOrders,
  getAllOrders,
  getOrderById,
} from "../controllers/order.controller.js"; // Import the controller
import { protect } from "../middlewares/authMiddleware.js";
import { protectAdmin } from "../middlewares/adminAuthMiddleware.js";
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

/**
 * @route   GET /api/v1/orders/my
 * @desc    Get all orders belonging to the authenticated customer
 * @access  Private
 */
router.get(
  "/my", // Route path relative to '/api/v1/orders'
  protect, // Ensure user is logged in
  catchAsync(getMyOrders) // Handle async errors
);

// --- Single Order Route ---
/**
 * @route   GET /api/v1/orders/:orderId
 * @desc    Get a specific order by ID (for the authenticated customer)
 * @access  Private (Customer)
 */
router.get(
  "/:orderId", // Matches URLs like /api/v1/orders/60b8d295f1d2a1001c8e4abc
  protect, // Ensure CUSTOMER is logged in
  catchAsync(getOrderById) // Use the new controller function
);

// --- Admin Route ---
/**
 * @route   GET /api/v1/orders
 * @desc    Get ALL orders (for admin panel)
 * @access  Private (Admin)
 */
router.get(
  "/", // Mounts at the base '/api/v1/orders'
  protectAdmin, // TODO: Replace with actual admin protection middleware (e.g., protectAdmin)
  catchAsync(getAllOrders)
);

export default router;
