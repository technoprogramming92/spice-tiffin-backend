// validators/categorySchema.ts
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string({
      required_error: "Category name is required",
    })
    .min(2, "Category name must be at least 2 characters long")
    .max(50, "Category name must not exceed 50 characters"),
});

export const updateCategorySchema = z.object({
  name: z
    .string({
      required_error: "Category name is required",
    })
    .min(2, "Category name must be at least 2 characters long")
    .max(50, "Category name must not exceed 50 characters"),
});
