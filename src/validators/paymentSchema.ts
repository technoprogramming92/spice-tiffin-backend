// validators/paymentSchema.ts
import { z } from "zod";

/**
 * Zod schema for validating the request body when a customer initiates
 * a Stripe Checkout Session to subscribe to a package.
 */
export const createCheckoutSessionSchema = z.object({
  /**
   * The MongoDB ObjectId (as a string) of the package the user
   * intends to subscribe to. This is required to fetch package
   * details like price and name for Stripe.
   */
  packageId: z
    .string({
      // Error message if the field is completely missing from the request body
      required_error: "Package ID is required to initiate payment.",
      // Error message if the field is present but not a string (e.g., a number)
      invalid_type_error: "Package ID must be provided as a string.",
    })
    // Ensure the string is not empty after removing whitespace
    .trim()
    .min(1, "Package ID cannot be empty."),
  // Optional: Add validation for ObjectId format if desired
  // .regex(/^[0-9a-fA-F]{24}$/, "Invalid Package ID format."), // Uncomment if needed
});

/**
 * TypeScript type inferred from the `createCheckoutSessionSchema`.
 * Useful for type-checking the validated request body in controllers and services.
 * Example: { packageId: string }
 */
export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionSchema
>;

// Add other payment-related schemas here if needed in the future
// e.g., schema for validating webhook payloads (though Stripe handles this)
// or schema for manual payment recording if applicable.
