// controllers/order.controller.ts
import { Request, Response, NextFunction } from "express";
import { Order } from "../models/Order.model.js";
import mongoose from "mongoose";

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

/**
 * @description Fetches a single order by its ID, ensuring it belongs to the authenticated customer.
 * @route GET /api/v1/orders/:orderId
 * @access Private (Requires customer authentication)
 */
export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params; // Get orderId from URL parameters
    const userId = req.userId; // Get userId from 'protect' middleware

    // 1. Check authentication (should be covered by middleware, but good practice)
    if (!userId) {
      // This case might already be handled by 'protect' middleware sending 401
      console.warn(
        "[OrderController] getOrderById: No userId found on request."
      );
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return; // Exit function
    }

    // 2. Validate the orderId format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.warn(
        `[OrderController] getOrderById: Invalid Order ID format: ${orderId}`
      );
      res
        .status(400)
        .json({ success: false, message: "Invalid Order ID format." });
      return; // Exit function
    }

    console.log(
      `[OrderController] Fetching order ID: ${orderId} for customer ID: ${userId}`
    );

    // 3. Find the order by ID AND customer ID
    // This ensures a customer can only fetch their own orders
    const order = await Order.findOne({ _id: orderId, customer: userId });
    // Optionally populate fields if needed by the frontend on this page
    // .populate("package", "name image"); // Example populate

    // 4. Handle Order Not Found
    if (!order) {
      console.log(
        `[OrderController] Order not found or does not belong to customer. Order ID: ${orderId}, Customer ID: ${userId}`
      );
      res.status(404).json({ success: false, message: "Order not found." });
      return; // Exit function
    }

    console.log(
      `[OrderController] Found order ${orderId} for customer ${userId}.`
    );

    // 5. Send Success Response
    res.status(200).json({
      success: true,
      message: "Order fetched successfully.",
      data: order,
    });
  } catch (error) {
    // 6. Handle other potential errors (e.g., database connection issues)
    console.error(
      `[OrderController] Error fetching order by ID (${req.params?.orderId}):`,
      error
    );
    // Pass error to the centralized error handler via next()
    // Assuming catchAsync utility handles this, otherwise use standard next(error)
    const fetchError = new Error(
      `Failed to fetch order: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    (fetchError as any).statusCode = 500; // Set appropriate status code if possible
    next(fetchError);
    // If not using catchAsync, you might structure the catch differently:
    // res.status(500).json({ success: false, message: `Failed to fetch order: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
};
