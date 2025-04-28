// src/validators/addonSchema.ts

import { z } from "zod";

// Schema for creating a new addon
export const createAddonSchema = z.object({
  name: z
    .string({
      required_error: "Addon name is required",
      invalid_type_error: "Addon name must be a string",
    })
    .min(2, "Addon name must be at least 2 characters long")
    .max(100, "Addon name must not exceed 100 characters") // Adjusted max length
    .trim(), // Remove leading/trailing whitespace

  price: z
    .number({
      required_error: "Addon price is required",
      invalid_type_error: "Price must be a number",
    })
    .nonnegative("Price must be a non-negative number (0 or greater)"), // Allows 0, use .positive() if price must be > 0

  image: z
    .string({
      required_error: "Addon image URL is required",
      invalid_type_error: "Image URL must be a string",
    })
    .url("Invalid image URL format") // Validate if it's a valid URL
    .trim(),
});

// Schema for updating an existing addon (all fields optional)
export const updateAddonSchema = z.object({
  name: z
    .string({
      invalid_type_error: "Addon name must be a string",
    })
    .min(2, "Addon name must be at least 2 characters long")
    .max(100, "Addon name must not exceed 100 characters")
    .trim()
    .optional(), // Make name optional for updates

  price: z
    .number({
      invalid_type_error: "Price must be a number",
    })
    .nonnegative("Price must be a non-negative number (0 or greater)")
    .optional(), // Make price optional for updates

  image: z
    .string({
      invalid_type_error: "Image URL must be a string",
    })
    .url("Invalid image URL format")
    .trim()
    .optional(), // Make image URL optional for updates
});

export type CreateAddonInput = z.infer<typeof createAddonSchema>;
export type UpdateAddonInput = z.infer<typeof updateAddonSchema>;
