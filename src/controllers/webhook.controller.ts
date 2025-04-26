// controllers/webhook.controller.ts
import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { stripe } from "../utils/stripe.js";
import { createOrderFromPayment } from "../services/order.service.js";

/**
 * Handles incoming webhook events from Stripe.
 * Verifies the signature and processes relevant events like 'checkout.session.completed'.
 *
 * @route POST /api/v1/webhooks/stripe
 * @access Public (but signature verification ensures authenticity)
 */
export const handleStripeEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Explicitly return Promise<void>
  // 1. Get Stripe Signature from header
  const signature = req.headers["stripe-signature"] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Validate essential configuration
  if (!endpointSecret) {
    console.error(
      "FATAL ERROR: Stripe webhook secret (STRIPE_WEBHOOK_SECRET) is not configured."
    );
    res.status(500).send("Webhook Error: Server configuration missing [WHS].");
    return; // <-- Add return
  }
  if (!signature) {
    console.warn("[Webhook] Error: Missing stripe-signature header.");
    res.status(400).send("Webhook Error: Missing signature.");
    return; // <-- Add return
  }

  let event: Stripe.Event;

  // 3. Verify webhook signature and construct event object
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
    console.log(
      `[Webhook] Received verified Stripe event: ${event.id} (${event.type})`
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Signature verification failed";
    console.error(
      `[Webhook] ⚠️ Webhook signature verification failed:`,
      message
    );
    res.status(400).send(`Webhook Error: ${message}`);
    return; // <-- Add return
  }

  // 4. Handle the specific event type(s)
  try {
    // Wrap event processing in try/catch to ensure 200 OK is sent if service fails internally
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(
          `[Webhook] Processing checkout.session.completed for Session ID: ${session.id}`
        );

        if (session.payment_status === "paid") {
          console.log(
            `[Webhook] Payment successful (status: ${session.payment_status}).`
          );

          const userId = session.metadata?.userId;
          const packageId = session.metadata?.packageId;
          const stripeCustomerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id;
          const stripePaymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;
          const amountPaid = session.amount_total;
          const currency = session.currency;

          if (
            !userId ||
            !packageId ||
            !stripeCustomerId ||
            !stripePaymentIntentId ||
            amountPaid === null ||
            amountPaid === undefined ||
            !currency
          ) {
            console.error(
              "[Webhook] Error: Missing required data in session metadata or session object.",
              {
                sessionId: session.id,
                userId,
                packageId,
                stripeCustomerId,
                stripePaymentIntentId,
                amountPaid,
                currency,
              }
            );
            // Send 400 but we still processed the event type, so maybe don't return early?
            // Let it fall through to the final 200 OK for Stripe.
            // Log the error thoroughly.
            break; // Break switch, but don't return 400 to Stripe here
          }

          // Optional: Fetch Payment Intent details
          let paymentMethodDetails;
          // ... (code to fetch payment intent details if needed) ...

          // Call Order Service (Can still throw errors)
          await createOrderFromPayment({
            userId,
            packageId,
            stripePaymentIntentId,
            stripeCustomerId,
            amountPaid,
            currency,
            paymentMethodDetails,
          });
          console.log(
            `[Webhook] Order creation process initiated successfully for session ${session.id}.`
          );
        } else {
          console.log(
            `[Webhook] Checkout session ${session.id} completed but payment status is '${session.payment_status}'. No order created.`
          );
        }
        break; // End case 'checkout.session.completed'

      // ... handle other event types ...

      default:
        console.log(`[Webhook] Received unhandled event type: ${event.type}`);
    }
  } catch (serviceError) {
    // This catches errors thrown by createOrderFromPayment or other processing logic
    console.error(
      `[Webhook] Internal error processing event ${event.id} (${event.type}):`,
      serviceError
    );
    // We still need to send 200 OK to Stripe to stop retries if the error is *our* fault (e.g., DB down),
    // unless it's an error we expect Stripe to retry (like temporary network issue).
    // Sending 500 might cause infinite retries from Stripe if our service keeps failing.
    // It's often better to acknowledge receipt (200 OK) and handle the failure internally (logging, monitoring).
    // If you *want* Stripe to retry, send a 5xx status code. Let's send 200 for now.
    // res.status(500).json({ received: false, error: 'Internal server error processing webhook.' });
    // return; // <-- Add return if sending 500
  }

  // 5. Acknowledge receipt of the event successfully processed (or ignored)
  console.log(
    `[Webhook] Sending 200 OK acknowledgment to Stripe for event ${event.id}.`
  );
  res.status(200).json({ received: true });
  // No explicit return needed here as it's the end of the function
};
