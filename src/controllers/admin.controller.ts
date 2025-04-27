import { NextFunction, Request, Response } from "express";
import { adminLoginSchema } from "../validators/adminSchema.js";
import { loginAdmin } from "../services/admin.service.js";
import { Customer } from "../models/Customer.model.js";

export const adminLogin = async (req: Request, res: Response) => {
  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
    }

    const { username, password } = parsed.data;
    const token = await loginAdmin(username, password);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};

/**
 * @description Fetches all customer records for the Admin Panel.
 * @route GET /api/v1/admin/customers
 * @access Private (Requires ADMIN authentication)
 */
export const getAllCustomers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Optional: Add pagination later using req.query.page and req.query.limit
    console.log(`[AdminController] Fetching all customers for Admin Panel...`);

    // Find all customers, excluding sensitive fields like password and OTP details
    const customers = await Customer.find({})
      .select("-password -otpCode -otpExpiresAt -otpSessionId -__v") // Exclude sensitive fields
      .sort({ createdAt: -1 }); // Sort by newest first

    console.log(`[AdminController] Found ${customers.length} customers.`);

    res.status(200).json({
      success: true,
      message: "Customers fetched successfully.",
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    console.error("[AdminController] Error fetching all customers:", error);
    const fetchError = new Error(
      `Failed to fetch customers: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    (fetchError as any).statusCode = 500;
    next(fetchError); // Pass error to global handler
  }
};
