import { NextFunction, Request, Response } from "express";
import { adminLoginSchema } from "../validators/adminSchema.js";
import { loginAdmin } from "../services/admin.service.js";
import { Customer } from "../models/Customer.model.js";
import { Order } from "../models/Order.model.js";

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

/**
 * @description Fetches active orders (endDate >= today) for the Admin Panel.
 * @route GET /api/v1/admin/orders/active
 * @access Private (Admin only)
 */
export const getActiveOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get the current date at the start of the day (00:00:00) in the server's local timezone.
  // IMPORTANT: Consider server timezone vs. user timezone if needed.
  // Using UTC might be more consistent if dealing with multiple timezones.
  // const startOfToday = new Date();
  // startOfToday.setUTCHours(0, 0, 0, 0); // Example using UTC start of day

  // Using local server time start of day:
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  console.log(
    `[AdminController] Fetching active orders with endDate >= ${startOfToday.toISOString()}`
  );

  const activeOrders = await Order.find({
    status: "Active", // Ensure the order is currently marked as Active
    endDate: { $gte: startOfToday }, // Filter where the end date is today or later
  })
    .populate({
      path: "customer",
      select: "name email phone address", // Select relevant customer fields
    })
    .populate({
      path: "package",
      select: "name type duration", // Select relevant package fields
    })
    .sort({ endDate: 1 }); // Sort by soonest ending date first (optional)

  console.log(`[AdminController] Found ${activeOrders.length} active orders.`);

  res.status(200).json({
    success: true,
    message: "Active orders fetched successfully.",
    count: activeOrders.length,
    data: activeOrders,
  });
};
