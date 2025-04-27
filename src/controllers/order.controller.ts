// controllers/order.controller.ts
import { Request, Response, NextFunction } from "express";
import { Order } from "../models/Order.model.js"; // Import the Order model

/**
 * @description Fetches the order history for the currently authenticated customer.
 * @route GET /api/v1/orders/my
 * @access Private (Requires customer authentication)
 */
export const getMyOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId; // From customer 'protect' middleware
    if (!userId) {
      const authError = new Error("Authentication required.");
      (authError as any).statusCode = 401;
      return next(authError);
    }
    console.log(`[OrderController] Fetching orders for customer ID: ${userId}`);
    const orders = await Order.find({ customer: userId })
      .populate("package", "name type image price days")
      .sort({ createdAt: -1 });
    console.log(
      `[OrderController] Found ${orders.length} orders for customer ${userId}.`
    );
    res.status(200).json({
      success: true,
      message: "Orders fetched successfully.",
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("[OrderController] Error fetching customer orders:", error);
    const fetchError = new Error(
      `Failed to fetch orders: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    (fetchError as any).statusCode = 500;
    next(fetchError); // Use return next() if preferred
  }
};

/**
 * @description Fetches ALL orders (for Admin Panel).
 * Populates customer and package details. Supports basic pagination.
 * @route GET /api/v1/orders
 * @access Private (Requires ADMIN authentication)
 */
export const getAllOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // TODO: Add pagination later if needed (e.g., using req.query.page and req.query.limit)
    // const page = parseInt(req.query.page as string) || 1;
    // const limit = parseInt(req.query.limit as string) || 20;
    // const skip = (page - 1) * limit;

    console.log(`[OrderController] Fetching all orders for Admin Panel...`);

    // Find all orders
    const orders = await Order.find({}) // Empty filter {} to get all
      // Populate customer details needed for admin view
      .populate("customer", "fullName email mobile") // Select fields from Customer
      // Populate selected package details
      .populate("package", "name type") // Select fields from Package
      .sort({ createdAt: -1 }); // Sort by most recent first
    // .skip(skip) // Add pagination later
    // .limit(limit);

    // Optional: Get total count for pagination info
    // const totalOrders = await Order.countDocuments({});

    console.log(`[OrderController] Found ${orders.length} total orders.`);

    res.status(200).json({
      success: true,
      message: "All orders fetched successfully.",
      count: orders.length, // Current batch count
      // total: totalOrders, // Add total later for pagination
      data: orders,
    });
  } catch (error) {
    console.error("[OrderController] Error fetching all orders:", error);
    const fetchError = new Error(
      `Failed to fetch all orders: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    (fetchError as any).statusCode = 500;
    next(fetchError); // Use return next() if preferred
  }
};
