// controllers/payment.controller.ts
import { Request, Response, NextFunction } from "express";
import { createCheckoutSessionSchema } from "../validators/paymentSchema.js"; // Zod schema for validation
import { Customer } from "../models/Customer.model.js"; // Customer model
import { Package } from "../models/Package.model.js"; // Package model
import { stripe } from "../utils/stripe.js"; // Initialized Stripe instance
// Removed AppError import

/**
 * @description Initiates a Stripe Checkout Session for a package subscription.
 * @route POST /api/v1/payments/create-checkout-session
 * @access Private (Requires authentication via 'protect' middleware)
 */
export const initiateCheckoutSession = async (
  req: Request,
  res: Response,
  next: NextFunction // Use next for error handling
) => {
  // 1. Validate Request Body
  const parsed = createCheckoutSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error("Validation Error:", parsed.error.flatten().fieldErrors);
    // Send validation errors directly as before
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    });
    // --- Alternative using standard Error + next ---
    // const validationError = new Error('Validation failed');
    // // Attach status code and specific errors for the global handler
    // (validationError as any).statusCode = 400;
    // (validationError as any).errors = parsed.error.flatten().fieldErrors;
    // return next(validationError);
    // --- End Alternative ---
  }
  const { packageId } = parsed.data;

  // 2. Get Authenticated User ID
  const userId = req.userId;
  if (!userId) {
    // Create a standard Error and pass to next
    const authError = new Error("Authentication required.");
    (authError as any).statusCode = 401; // Attach status code
    return next(authError);
  }

  // 3. Check for necessary environment variables
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("FATAL ERROR: STRIPE_SECRET_KEY is not set.");
    const configError = new Error("Server configuration error [S1].");
    (configError as any).statusCode = 500;
    return next(configError);
  }
  if (!process.env.FRONTEND_URL) {
    console.error("FATAL ERROR: FRONTEND_URL is not set for Stripe redirects.");
    const configError = new Error("Server configuration error [F1].");
    (configError as any).statusCode = 500;
    return next(configError);
  }

  try {
    // 4. Fetch Customer and Package
    const [customer, selectedPackage] = await Promise.all([
      Customer.findById(userId).select("stripeCustomerId email"),
      Package.findById(packageId).select("name price"),
    ]);

    // 5. Validate Customer and Package Data
    if (!customer) {
      const notFoundError = new Error("Customer not found.");
      (notFoundError as any).statusCode = 404;
      return next(notFoundError);
    }
    if (!customer.stripeCustomerId) {
      console.error(`Customer ${userId} is missing stripeCustomerId.`);
      const setupError = new Error("Customer payment profile not set up.");
      (setupError as any).statusCode = 400;
      return next(setupError);
    }
    if (!selectedPackage) {
      const notFoundError = new Error(
        `Package with ID ${packageId} not found.`
      );
      (notFoundError as any).statusCode = 404;
      return next(notFoundError);
    }

    // 6. Prepare Stripe Data
    const priceInCents = Math.round(selectedPackage.price * 100);
    const frontendUrl = process.env.FRONTEND_URL;
    const successUrl = `${frontendUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/packages`;

    // 7. Create Stripe Checkout Session
    console.log(
      `Creating Stripe session for user ${userId}, package ${packageId}, price ${priceInCents} cents CAD`
    );
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer: customer.stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: { name: selectedPackage.name },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId.toString(),
        packageId: packageId.toString(),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    // 8. Respond to Frontend with Session ID
    if (!session.id) {
      console.error("Stripe session created but missing ID:", session);
      const stripeError = new Error("Failed to create payment session [S2].");
      (stripeError as any).statusCode = 500;
      return next(stripeError);
    }

    res.status(200).json({
      success: true,
      message: "Checkout session created successfully.",
      data: { sessionId: session.id },
    });
  } catch (error) {
    // Catch errors from DB lookups or Stripe API
    console.error("Error creating Stripe checkout session:", error);
    // Create a standard Error and pass to next
    const processingError = new Error(
      `Failed to initiate payment: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    (processingError as any).statusCode = 500; // Set a default status code
    next(processingError);
  }
};

// Add other payment-related controller functions here if needed later
