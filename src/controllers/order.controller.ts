// controllers/order.controller.ts
import { Request, Response, NextFunction } from "express";
import { Order } from "../models/Order.model.js"; // Import the Order model
// Removed AppError import, assuming standard Error handling via middleware

/**
 * @description Fetches the order history for the currently authenticated customer.
 * @route GET /api/v1/orders/my
 * @access Private (Requires authentication via 'protect' middleware)
 */
export const getMyOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get authenticated user ID attached by the 'protect' middleware
    const userId = req.userId;
    if (!userId) {
      // This should ideally be caught by the 'protect' middleware,
      // but it's good practice to double-check.
      const authError = new Error("Authentication required to view orders.");
      (authError as any).statusCode = 401;
      return next(authError);
    }

    console.log(`[OrderController] Fetching orders for customer ID: ${userId}`);

    // Find orders belonging to the customer
    const orders = await Order.find({ customer: userId })
      // Optional: Populate package details if needed on the order list view
      // Adjust fields as necessary ('name type image' are examples)
      .populate("package", "name type image price days") // Populate selected package fields
      .sort({ createdAt: -1 }); // Sort by most recent first

    console.log(
      `[OrderController] Found ${orders.length} orders for customer ${userId}.`
    );

    // Send the orders back to the client
    res.status(200).json({
      success: true,
      message: "Orders fetched successfully.",
      count: orders.length, // Optional: include count
      data: orders,
    });
  } catch (error) {
    // Pass any database or other errors to the global error handler
    console.error("[OrderController] Error fetching customer orders:", error);
    const fetchError = new Error(
      `Failed to fetch orders: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    (fetchError as any).statusCode = 500; // Default to internal server error
    next(fetchError);
  }
};

// Add other order-related controller functions here later if needed
// e.g., getOrderById, cancelOrder (if applicable)
