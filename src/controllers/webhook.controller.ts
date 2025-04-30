// controllers/webhook.controller.ts
import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { stripe } from "../utils/stripe.js"; // Initialized Stripe instance
import { createOrderFromPayment } from "../services/order.service.js";
import { AddonOrderService } from "../services/addon-order.service.js";

const addonOrderService = new AddonOrderService();

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

  // 2. Validate essential configuration
  if (!endpointSecret) {
    console.error(
      "FATAL ERROR: Stripe webhook secret (STRIPE_WEBHOOK_SECRET) is not configured."
    );
    res.status(500).send("Webhook Error: Server configuration missing [WHS].");
    return;
  }
  if (!signature) {
    console.warn("[Webhook] Error: Missing stripe-signature header.");
    res.status(400).send("Webhook Error: Missing signature.");
    return;
  }

  let event: Stripe.Event;

  // 3. Verify webhook signature and construct event object
  try {
    // IMPORTANT: Use req.body (raw buffer) provided by express.raw middleware applied in app.ts
    event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
    // Log only event ID and type initially for brevity unless debugging verification
    // console.log(`[Webhook] Received verified Stripe event: ${event.id} (${event.type})`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Signature verification failed";
    console.error(
      `[Webhook] ⚠️ Webhook signature verification failed:`,
      message
    );
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  // 4. Handle the specific event type(s) we care about
  try {
    // Wrap event processing in try/catch to ensure 200 OK is sent if service fails internally
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(
          `[Webhook] Processing checkout.session.completed. Session ID: ${session.id}, Payment Status: ${session.payment_status}`
        );

        // --- Validate the Session Data ---
        if (session.payment_status === "paid") {
          console.log(`[Webhook] Payment status is 'paid'. Extracting data...`);

          // Extract necessary data from session and metadata
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
          const amountPaid = session.amount_total; // Amount in cents/smallest unit
          const currency = session.currency;

          // --- Log Extracted Data ---
          console.log("[Webhook] Extracted Data:", {
            userId,
            packageId,
            stripeCustomerId,
            stripePaymentIntentId,
            amountPaid,
            currency,
          });
          // -------------------------

          // --- Basic validation of extracted data ---
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
              "[Webhook] CRITICAL ERROR: Missing required data in session metadata or session object. Cannot create order."
            );
            // Log the entire metadata object for inspection
            console.error("[Webhook] Session Metadata:", session.metadata);
            // Acknowledge Stripe but log critical failure - DO NOT proceed to create order
            break; // Exit switch, will send 200 OK below
          }

          // Optional: Fetch Payment Intent details (keep commented unless needed)
          let paymentMethodDetails;
          // if (stripePaymentIntentId) { ... }

          // --- Call Order Service ---
          // Prepare parameters for the service function
          const orderParams = {
            userId,
            packageId,
            stripePaymentIntentId,
            stripeCustomerId,
            amountPaid,
            currency,
            paymentMethodDetails, // Pass details if fetched
          };
          console.log(
            `[Webhook] Data seems valid. Calling createOrderFromPayment with params:`,
            orderParams
          );
          // Await the service call to catch errors here
          await createOrderFromPayment(orderParams);
          console.log(
            `[Webhook] createOrderFromPayment finished successfully for session ${session.id}.`
          );
        } else {
          // Log if payment status is not 'paid'
          console.log(
            `[Webhook] Checkout session ${session.id} completed but payment status is '${session.payment_status}'. No order created.`
          );
        }
        break; // End case 'checkout.session.completed'

      case "payment_intent.succeeded":
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(
          `[Webhook] Processing payment_intent.succeeded: ${paymentIntent.id}`
        );
        // --- MODIFIED: Use the instantiated service ---
        // The service handles finding the order by PI ID and confirming
        await addonOrderService.confirmAddonOrderPayment(paymentIntent.id);
        console.log(
          `[Webhook] Addon payment confirmation processed for PI: ${paymentIntent.id}`
        );
        break;

      case "payment_intent.payment_failed":
        const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
        console.warn(
          `[Webhook] Received payment_intent.payment_failed: ${failedPaymentIntent.id}`,
          failedPaymentIntent.last_payment_error
        );
        // TODO: Update AddonOrder status to 'Failed' via service if applicable
        break;

      default:
        // Acknowledge unhandled event types without erroring
        console.log(`[Webhook] Received unhandled event type: ${event.type}`);
    }
  } catch (serviceError) {
    // This catches errors specifically thrown by createOrderFromPayment or other processing logic within the switch
    console.error(
      `[Webhook] INTERNAL ERROR processing event ${event.id} (${event.type}):`,
      serviceError instanceof Error ? serviceError.message : serviceError
    );
    // Log the full error for more details
    console.error("[Webhook] Full internal error details:", serviceError);

    // Decide whether to send 500 (retry) or 200 (acknowledge & handle internally)
    // Sending 200 OK is generally safer to prevent infinite retries from Stripe for persistent internal errors.
    // Log thoroughly so you can investigate the internal failure.
    // If you are confident the error is temporary and want Stripe to retry, send 5xx.
    // res.status(500).json({ received: false, error: 'Internal server error processing webhook.' });
    // return; // Make sure to return if sending 500
  }

  // 5. Acknowledge receipt of the event successfully processed (or ignored)
  console.log(
    `[Webhook] Sending 200 OK acknowledgment to Stripe for event ${event.id}.`
  );
  res.status(200).json({ received: true });
  // No explicit return needed here as it's the end of the function
};
