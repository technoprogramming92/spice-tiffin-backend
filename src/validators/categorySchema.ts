// src/validators/categorySchema.ts
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(2, "Category name is required"),
});

export const updateCategorySchema = z.object({
  name: z.string().optional(),
  packages: z.array(z.string()).optional(), // future use
});
