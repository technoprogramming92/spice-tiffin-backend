// src/validators/driverSchema.ts

import { z } from "zod";
import mongoose from "mongoose";

export const createDriverSchema = z.object({
  body: z.object({
    fullName: z
      .string({ required_error: "Full name is required" })
      .min(3, "Full name must be at least 3 characters long"),
    phone: z
      .string({ required_error: "Phone number is required" })
      .min(10, "Phone number seems too short"), // Basic length check
    // Consider adding .regex() for specific phone format if needed
    vehicleNumber: z
      .string({ required_error: "Vehicle number is required" })
      .min(4, "Vehicle number seems too short"),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters"),
    status: z.enum(["Active", "Inactive"]).optional(), // Optional on create, defaults in model
  }),
});

export const updateDriverSchema = z.object({
  body: z
    .object({
      fullName: z
        .string()
        .min(3, "Full name must be at least 3 characters long")
        .optional(),
      phone: z.string().min(10, "Phone number seems too short").optional(),
      vehicleNumber: z
        .string()
        .min(4, "Vehicle number seems too short")
        .optional(),
      password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .optional(), // Optional on update
      status: z.enum(["Active", "Inactive"]).optional(),
    })
    .partial() // Makes all fields optional
    .refine(
      (data) => Object.keys(data).length > 0, // Ensure at least one field is provided for update
      { message: "At least one field must be provided for update" }
    ),
  params: z.object({
    id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid driver ID format",
    }),
  }),
});

export const driverIdParamSchema = z.object({
  params: z.object({
    id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid driver ID format",
    }),
  }),
});

// Type Definitions from Schemas (optional but useful for controllers)
export type CreateDriverInput = z.infer<typeof createDriverSchema>["body"];
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>["body"];
export type DriverIdParamInput = z.infer<typeof driverIdParamSchema>["params"];
