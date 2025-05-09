import { NextFunction, Request, Response } from "express";
import { adminLoginSchema } from "../validators/adminSchema.js";
import { loginAdmin } from "../services/admin.service.js";
import { Customer } from "../models/Customer.model.js";
import { Order, DeliveryStatus } from "../models/Order.model.js";
import { Driver } from "../models/Driver.model.js";

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
      select: "fullName email phone address", // Select relevant customer fields
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

export const getAssignableOrders = async (req: Request, res: Response) => {
  try {
    console.log("[AdminController] Fetching assignable orders...");

    const assignableOrders = await Order.find({
      deliveryStatus: DeliveryStatus.IN_PROGRESS, // Use the enum value
      "deliveryAddress.latitude": { $ne: null }, // Ensure latitude exists
      "deliveryAddress.longitude": { $ne: null }, // Ensure longitude exists
      // Optional: Add date filters if needed, e.g., for today's orders only
      // endDate: { $gte: startOfToday, $lt: endOfToday }
    })
      .populate("customer", "fullName email") // Populate basic customer info
      .populate("package", "name type") // Populate basic package info
      .sort({ createdAt: 1 }); // Sort by oldest first (optional)

    console.log(
      `[AdminController] Found ${assignableOrders.length} assignable orders.`
    );

    return res.status(200).json({
      success: true,
      message: "Assignable orders fetched successfully.",
      count: assignableOrders.length,
      data: assignableOrders,
    });
  } catch (error: any) {
    console.error("[AdminController] Error fetching assignable orders:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching assignable orders",
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
};

/**
 * @description Fetches drivers who are currently active.
 * @route GET /api/v1/admin/drivers/active
 * @access Private (Admin only)
 */
export const getActiveDrivers = async (req: Request, res: Response) => {
  try {
    console.log("[AdminController] Fetching active drivers...");

    const activeDrivers = await Driver.find({
      status: "Active", // Filter by status
    }).sort({ fullName: 1 }); // Sort alphabetically by name (optional)
    // Password is automatically excluded due to `select: false` in the Driver model

    console.log(
      `[AdminController] Found ${activeDrivers.length} active drivers.`
    );

    return res.status(200).json({
      success: true,
      message: "Active drivers fetched successfully.",
      count: activeDrivers.length,
      data: activeDrivers,
    });
  } catch (error: any) {
    console.error("[AdminController] Error fetching active drivers:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching active drivers",
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
};
