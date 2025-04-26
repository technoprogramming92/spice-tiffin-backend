// controllers/webhook.controller.ts
import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { stripe } from "../utils/stripe.js"; // Initialized Stripe instance
import { createOrderFromPayment } from "../services/order.service.js"; // Import order creation service
// Removed AppError import, using standard Error

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
) => {
  // 1. Get Stripe Signature from header
  const signature = req.headers["stripe-signature"] as string;

  // 2. Get Stripe Webhook Secret from environment variables
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Validate essential configuration
  if (!endpointSecret) {
    console.error(
      "FATAL ERROR: Stripe webhook secret (STRIPE_WEBHOOK_SECRET) is not configured in environment variables."
    );
    // Respond directly to Stripe, don't use next() for config errors usually
    return res
      .status(500)
      .send("Webhook Error: Server configuration missing [WHS].");
  }
  if (!signature) {
    console.warn("[Webhook] Error: Missing stripe-signature header.");
    return res.status(400).send("Webhook Error: Missing signature.");
  }

  let event: Stripe.Event;

  // 3. Verify webhook signature and construct event object
  try {
    // IMPORTANT: Use req.body (raw buffer) provided by express.raw middleware applied in app.ts
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
    // Respond to Stripe indicating a signature error
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  // 4. Handle the specific event type(s) we care about
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(
        `[Webhook] Processing checkout.session.completed for Session ID: ${session.id}`
      );

      // --- Validate the Session Data ---
      // Ensure payment was successful
      if (session.payment_status === "paid") {
        console.log(
          `[Webhook] Payment successful (status: ${session.payment_status}).`
        );

        // Extract necessary data from session and metadata
        const userId = session.metadata?.userId;
        const packageId = session.metadata?.packageId;
        // Handle customer being potentially an object or just an ID string
        const stripeCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        // Handle payment_intent being potentially an object or just an ID string
        const stripePaymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        const amountPaid = session.amount_total; // Amount in cents/smallest unit
        const currency = session.currency;

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
          // Respond with an error - Stripe might retry.
          // 400 suggests bad data in the event itself.
          return res
            .status(400)
            .json({
              received: false,
              error: "Webhook Error: Missing required data in session.",
            });
        }

        // --- TODO: Optionally retrieve Payment Intent for more details ---
        // This might be needed if you want card brand/last4 reliably
        let paymentMethodDetails;
        // if (stripePaymentIntentId) {
        //     try {
        //         const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId, { expand: ['payment_method'] });
        //         if (paymentIntent.payment_method && typeof paymentIntent.payment_method !== 'string' && paymentIntent.payment_method.card) {
        //              paymentMethodDetails = {
        //                  type: paymentIntent.payment_method.type, // 'card'
        //                  card: {
        //                      brand: paymentIntent.payment_method.card.brand,
        //                      last4: paymentIntent.payment_method.card.last4
        //                  }
        //              }
        //         }
        //     } catch (piError) {
        //          console.error(`[Webhook] Error retrieving PaymentIntent ${stripePaymentIntentId}:`, piError);
        //          // Decide if this is critical - maybe proceed without card details?
        //     }
        // }
        // --- End Optional Payment Intent Fetch ---

        // --- Call Order Service ---
        try {
          console.log(
            `[Webhook] Calling createOrderFromPayment for user ${userId}, package ${packageId}`
          );
          // Pass extracted data to the service function
          await createOrderFromPayment({
            userId,
            packageId,
            stripePaymentIntentId,
            stripeCustomerId,
            amountPaid,
            currency,
            paymentMethodDetails, // Pass details if fetched
          });
          console.log(
            `[Webhook] Order creation process initiated successfully for session ${session.id}.`
          );
          // If createOrderFromPayment succeeds or handles idempotency, we acknowledge success to Stripe
        } catch (orderError) {
          console.error(
            `[Webhook] Error calling createOrderFromPayment for session ${session.id}:`,
            orderError
          );
          // If createOrderFromPayment throws an error (e.g., validation, DB error, unexpected issue),
          // respond with 500 to signal Stripe to retry the webhook later.
          // Ensure createOrderFromPayment is idempotent (handles duplicate calls safely).
          return res
            .status(500)
            .json({
              received: false,
              error: "Webhook Error: Failed to process order.",
            });
        }
      } else {
        // Handle other payment statuses if necessary (e.g., 'unpaid', 'no_payment_required')
        console.log(
          `[Webhook] Checkout session ${session.id} completed but payment status is '${session.payment_status}'. No order created.`
        );
      }
      break; // End case 'checkout.session.completed'

    // --- Handle other event types if needed ---
    // case 'invoice.payment_succeeded':
    // // Handle recurring subscription payments if using Stripe Subscriptions
    // break;
    // case 'payment_intent.succeeded':
    //     // Handle direct Payment Intents if used elsewhere
    //     break;

    default:
      // Acknowledge other event types we don't explicitly handle
      console.log(`[Webhook] Received unhandled event type: ${event.type}`);
  }

  // 5. Acknowledge receipt of the event successfully processed (or ignored)
  console.log(
    `[Webhook] Sending 200 OK acknowledgment to Stripe for event ${event.id}.`
  );
  res.status(200).json({ received: true });
};
