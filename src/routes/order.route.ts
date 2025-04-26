// routes/order.route.ts
import { Router } from "express";
import { getMyOrders } from "../controllers/order.controller.js"; // Import the controller
import { protect } from "../middlewares/authMiddleware.js"; // Import auth middleware
import { catchAsync } from "../utils/catchAsync.js"; // Import async error handler

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

// Add other order-specific routes here later if needed
// e.g., router.get('/:orderId', protect, catchAsync(getOrderDetails));
// e.g., router.patch('/:orderId/cancel', protect, catchAsync(cancelMyOrder));

export default router;
