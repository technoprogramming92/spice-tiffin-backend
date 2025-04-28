// src/controllers/assignment.controller.ts

import { Request, Response } from "express";
import { Order, DeliveryStatus } from "../models/Order.model.js"; // Adjust path
import mongoose from "mongoose";

/**
 * @description Fetches orders assigned to a specific driver, usually for a specific date range (defaulting to active).
 * @route GET /api/v1/admin/assignments?driverId=<driver_id>&status=<status>
 * @access Private (Admin only)
 */
export const getAssignedOrders = async (req: Request, res: Response) => {
  const { driverId, status } = req.query; // Get driverId and optional status from query params

  // 1. Validate Driver ID
  if (
    !driverId ||
    typeof driverId !== "string" ||
    !mongoose.Types.ObjectId.isValid(driverId)
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid driverId query parameter is required.",
    });
  }

  // 2. Define Filter Criteria
  const filter: mongoose.FilterQuery<any> = {
    // Use 'any' or a more specific type for FilterQuery if needed
    assignedDriver: driverId, // Filter by the specified driver
    // Default to fetching orders that are relevant for a current route
    deliveryStatus: {
      $in: [DeliveryStatus.ASSIGNED, DeliveryStatus.OUT_FOR_DELIVERY],
    },
    "deliveryAddress.latitude": { $ne: null }, // Ensure coordinates exist for mapping
    "deliveryAddress.longitude": { $ne: null },
  };

  // Optional: Allow filtering by specific status if provided in query
  if (
    status &&
    typeof status === "string" &&
    Object.values(DeliveryStatus).includes(status as DeliveryStatus)
  ) {
    filter.deliveryStatus = status as DeliveryStatus;
  } else if (status) {
    console.warn(
      `[AssignmentController] Invalid status query parameter received: ${status}. Using default statuses.`
    );
  }

  // Optional: Add date filtering if needed (e.g., only show orders ending today/future)
  // const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  // filter.endDate = { $gte: todayStart };

  console.log(
    `[AssignmentController] Fetching assigned orders for driver ${driverId} with filter:`,
    filter
  );

  try {
    // 3. Fetch Orders
    const assignedOrders = await Order.find(filter)
      .populate("customer", "fullName address city postalCode") // Populate details needed for map/list
      .populate("package", "name")
      .sort({ deliverySequence: 1, createdAt: 1 }); // Sort primarily by sequence, then by creation time

    console.log(
      `[AssignmentController] Found ${assignedOrders.length} assigned orders for driver ${driverId}.`
    );

    return res.status(200).json({
      success: true,
      message: "Assigned orders fetched successfully.",
      count: assignedOrders.length,
      data: assignedOrders,
    });
  } catch (error: any) {
    console.error(
      `[AssignmentController] Error fetching assigned orders for driver ${driverId}:`,
      error
    );
    return res.status(500).json({
      success: false,
      message: "Error fetching assigned orders",
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
};

// Make sure the 'export' keyword is present!
export const assignOrdersToDriver = async (req: Request, res: Response) => {
  // --- Your logic to assign orders goes here ---
  const { driverId, orderIds } = req.body; // Example: Get data from request body

  // 1. Validate input (driverId, orderIds)
  if (!driverId || !Array.isArray(orderIds) || orderIds.length === 0) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Driver ID and a list of order IDs are required.",
      });
  }

  try {
    // 2. Call a service function to perform the database update
    // const result = await yourAssignmentService.assignOrders(driverId, orderIds);

    // 3. Send a success response
    res.status(200).json({
      success: true,
      message: `Successfully assigned ${orderIds.length} orders to driver ${driverId}.`,
      // data: result // Optionally return updated data
    });
  } catch (error: any) {
    // 4. Handle errors
    console.error("Error assigning orders:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to assign orders.",
      });
  }
};

// --- Add assignOrdersToDriver function here later ---
// export const assignOrdersToDriver = async (req: Request, res: Response) => { ... };
