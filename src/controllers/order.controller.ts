// controllers/order.controller.ts
import { Request, Response, NextFunction } from "express";
import { Order, OrderStatus } from "../models/Order.model.js";
import mongoose from "mongoose";
import {
  getAdminOrderById as getAdminOrderByIdService,
  updateAdminOrder as updateAdminOrderService,
  deleteAdminOrder as deleteAdminOrderService,
  // Import createOrderFromPayment if it's also in the service file now
} from "../services/order.service.js";

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
    // --- Pagination Parameters ---
    const page = parseInt(req.query.page as string) || 1; // Default to page 1
    const limit = parseInt(req.query.limit as string) || 15; // Default to 15 items per page
    const skip = (page - 1) * limit;

    // --- Filter Parameters ---
    const statusFilter = req.query.status as string; // e.g., "Active", "Expired"
    const searchQuery = req.query.search as string; // Search term

    console.log(
      `[OrderController] Fetching all orders for Admin Panel - Page: ${page}, Limit: ${limit}, Status: ${statusFilter || "All"}, Search: ${searchQuery || "None"}`
    );

    // --- Build Mongoose Filter Query ---
    const filterQuery: mongoose.FilterQuery<typeof Order> = {}; // Start with empty filter

    // Add status filter if provided and valid
    if (
      statusFilter &&
      Object.values(OrderStatus).includes(statusFilter as OrderStatus)
    ) {
      filterQuery.status = statusFilter;
      console.log(`[OrderController] Filtering by status: ${statusFilter}`);
    }

    // Add search filter if provided
    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, "i"); // Case-insensitive regex search
      console.log(`[OrderController] Filtering by search term: ${searchQuery}`);
      // Search relevant fields on the Order model itself
      filterQuery.$or = [
        { orderNumber: { $regex: searchRegex } },
        { packageName: { $regex: searchRegex } },
        // Add other direct fields if needed
        // { 'deliveryAddress.city': { $regex: searchRegex } },
        // { 'deliveryAddress.postalCode': { $regex: searchRegex } }
      ];
      // IMPORTANT: Searching populated fields (like customer name/email) directly
      // in the main query can be inefficient. For production with large data,
      // consider:
      // 1. Denormalizing essential searchable fields (like customer name) onto the Order schema.
      // 2. Performing a separate search on the Customer collection first to get matching IDs,
      //    then adding `customer: { $in: [matchingCustomerIds] }` to filterQuery.
      // For simplicity now, we'll stick to searching Order fields.
    }

    // --- Execute Queries (Count and Find) ---
    console.log("[OrderController] Executing count and find queries...");
    // Use Promise.all for efficiency
    const [totalOrders, orders] = await Promise.all([
      Order.countDocuments(filterQuery), // Count documents matching the filters
      Order.find(filterQuery) // Find documents matching filters with pagination/sort
        .populate("customer", "fullName email mobile") // Keep population
        .populate("package", "name type")
        .sort({ createdAt: -1 }) // Keep sort order
        .skip(skip)
        .limit(limit),
    ]);
    console.log(
      `[OrderController] Found ${totalOrders} total matching orders, returning ${orders.length} for page ${page}.`
    );

    // --- Calculate Pagination Metadata ---
    const totalPages = Math.ceil(totalOrders / limit);

    // --- Send Response ---
    res.status(200).json({
      success: true,
      message: "Orders fetched successfully for admin.",
      count: orders.length, // Count for the current page
      // --- MODIFIED: Add 'data' object containing orders and pagination ---
      data: {
        orders: orders,
        pagination: {
          totalOrders: totalOrders,
          totalPages: totalPages,
          currentPage: page,
          limit: limit, // Include limit in response
          // Optional: Calculate hasNextPage/hasPrevPage if needed
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      // ------------------------------------------------------------------
    });
  } catch (error) {
    console.error("[OrderController] Error fetching all orders:", error);
    const fetchError = new Error(
      `Failed to fetch orders: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    (fetchError as any).statusCode = 500;
    next(fetchError);
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

/** GET /admin/orders/:orderId */
export const getAdminOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    // Call the SERVICE function
    const order = await getAdminOrderByIdService(orderId);
    // Service throws errors for invalid ID / not found, caught by catchAsync/next
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error); // Pass to error handler
  }
};

/** PUT /admin/orders/:orderId */
export const updateAdminOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;

    if (
      !updateData ||
      typeof updateData !== "object" ||
      Object.keys(updateData).length === 0
    ) {
      res.status(400).json({ success: false, message: "Missing update data." });
      return;
    }

    // Call the SERVICE function
    const updatedOrder = await updateAdminOrderService(orderId, updateData);
    // Service throws errors for invalid ID / not found / validation errors
    res.status(200).json({
      success: true,
      message: "Order updated successfully.",
      data: updatedOrder,
    });
  } catch (error) {
    next(error); // Pass to error handler
  }
};

/** DELETE /admin/orders/:orderId */
export const deleteAdminOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    // Call the SERVICE function
    await deleteAdminOrderService(orderId); // Service throws errors for invalid ID / not found
    // Send success response
    res
      .status(200)
      .json({ success: true, message: "Order deleted successfully." });
  } catch (error) {
    next(error);
  }
};
