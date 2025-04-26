// routes/webhook.route.ts
import { Router } from "express";
import { handleStripeEvents } from "../controllers/webhook.controller.js";

const router = Router();

/**
 * @route   POST /api/v1/webhooks/stripe
 * @desc    Handles incoming webhook events from Stripe
 * @access  Public (Signature verification is handled within the controller)
 */
router.post(
  "/stripe",
  // IMPORTANT: Ensure express.raw({ type: 'application/json' }) middleware
  // is applied specifically to this route *before* this router is mounted in app.ts
  handleStripeEvents // Directly use the controller, no catchAsync needed here
);

// Export the router to be used in app.ts
export default router;
