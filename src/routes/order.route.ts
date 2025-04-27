// routes/order.route.ts
import { Router } from "express";
import { getMyOrders, getAllOrders } from "../controllers/order.controller.js"; // Import the controller
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
