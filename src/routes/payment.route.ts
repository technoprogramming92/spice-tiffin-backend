// routes/payment.route.ts
import { Router } from "express";
import { initiateCheckoutSession } from "../controllers/payment.controller.js"; // Import the controller
import { protect } from "../middlewares/authMiddleware.js"; // Import auth middleware
import { catchAsync } from "../utils/catchAsync.js"; // Import async error handler utility

// Create a new Express router instance
const router = Router();

/**
 * @route   POST /api/v1/payments/create-checkout-session
 * @desc    Initiate a Stripe Checkout Session for a selected package
 * @access  Private (Requires user to be logged in)
 */
router.post(
  "/create-checkout-session", // The specific path for this route
  protect, // Apply authentication middleware first
  catchAsync(initiateCheckoutSession) // Wrap the async controller for error handling
);

// Add other payment-related routes here later if needed
// e.g., router.get('/status/:sessionId', protect, catchAsync(getPaymentStatus));

// Export the router to be used in app.ts
export default router;
