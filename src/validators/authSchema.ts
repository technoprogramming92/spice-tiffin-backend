// Purpose: Zod schema for validating customer registration input
import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Invalid email"),
    mobile: z.string().min(10, "Mobile number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  mobile: z.string().min(10),
  password: z.string().min(6),
});

export const otpVerifySchema = z.object({
  mobile: z.string().min(10),
  otp: z.string().length(4),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
