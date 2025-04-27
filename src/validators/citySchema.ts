// validators/citySchema.ts
import { z } from "zod";

/**
 * Zod schema for validating data when creating a new City.
 */
export const createCitySchema = z.object({
  name: z
    .string({
      required_error: "City name is required.",
      invalid_type_error: "City name must be a string.",
    })
    .trim()
    .min(2, "City name must be at least 2 characters long.")
    .max(100, "City name cannot exceed 100 characters."), // Example max length
});

/**
 * Zod schema for validating data when updating an existing City.
 * Makes 'name' optional but applies same constraints if provided.
 */
export const updateCitySchema = createCitySchema.partial();
// Alternatively, define explicitly if update rules differ significantly:
// export const updateCitySchema = z.object({
//   name: z
//     .string()
//     .trim()
//     .min(2, "City name must be at least 2 characters long.")
//     .max(100, "City name cannot exceed 100 characters.")
//     .optional(), // Name is optional on update
// });

/**
 * TypeScript type inferred from the `createCitySchema`.
 * Example: { name: string }
 */
export type CreateCityInput = z.infer<typeof createCitySchema>;

/**
 * TypeScript type inferred from the `updateCitySchema`.
 * Example: { name?: string }
 */
export type UpdateCityInput = z.infer<typeof updateCitySchema>;
