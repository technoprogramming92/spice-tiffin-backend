// validators/customerSchema.ts
import { z } from "zod";

// Schema for updating customer profile information
// All fields are optional, but if provided, they should be strings
// Add length constraints as needed
export const updateProfileSchema = z.object({
  // fullName, email, mobile are usually not updated here, handle separately if needed
  address: z
    .string()
    .max(200, "Address cannot exceed 200 characters")
    .optional(),
  city: z.string().max(50, "City name cannot exceed 50 characters").optional(),
  postalCode: z
    .string()
    // Basic validation example - adjust regex for specific country formats if needed
    .regex(/^[a-zA-Z0-9\s-]{3,10}$/, "Invalid postal code format")
    .optional(),
  currentLocation: z
    .string() // Could be coordinates or descriptive text
    .max(100, "Location cannot exceed 100 characters")
    .optional(),
});

// Type inferred from the schema
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
