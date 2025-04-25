// validators/packageSchema.ts
import { z } from "zod";

export const createPackageSchema = z.object({
  name: z
    .string({
      required_error: "Package name is required",
    })
    .min(2, "Package name must be at least 2 characters")
    .max(100, "Package name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  price: z
    .number({
      required_error: "Price is required",
      invalid_type_error: "Price must be a number",
    })
    .min(0, "Price must be at least 0"),
  type: z.enum(["trial", "weekly", "monthly"], {
    required_error: "Package type is required",
  }),
  days: z
    .number({
      required_error: "Days are required",
      invalid_type_error: "Days must be a number",
    })
    .int("Days must be an integer")
    .min(1, "Days must be at least 1"),
  category: z
    .string({
      required_error: "Category ID is required",
    })
    .min(1, "Category ID is invalid"),
  image: z.string().url("Image must be a valid URL").optional(),
});

export const updatePackageSchema = createPackageSchema.partial();
