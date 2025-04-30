// src/controllers/addon-order.controller.ts
import { Request, Response, NextFunction } from "express";
import { AddonOrderService } from "../services/addon-order.service.js";
import mongoose from "mongoose"; // Import mongoose for ObjectId check

// Instantiate the service (standard class instantiation)
const addonOrderService = new AddonOrderService();

/**
 * @description Initiates the payment process for an addon order.
 * @route POST /api/v1/addon-orders/initiate-payment
 * @access Private (Customer)
 */
export const initiateAddonOrderPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.userId;

  if (!userId) {
    res
      .status(401)
      .json({ success: false, message: "Authentication required." });
    return;
  }

  // --- Basic Validation of req.body ---
  const { originalOrderId, deliveryDate, addons } = req.body;

  if (!originalOrderId || !mongoose.Types.ObjectId.isValid(originalOrderId)) {
    res
      .status(400)
      .json({ success: false, message: "Invalid or missing originalOrderId." });
    return;
  }
  // Validate Date (basic check if it's a string and can be parsed)
  if (
    !deliveryDate ||
    typeof deliveryDate !== "string" ||
    isNaN(new Date(deliveryDate).getTime())
  ) {
    res
      .status(400)
      .json({ success: false, message: "Invalid or missing deliveryDate." });
    return;
  }
  // Validate addons array structure
  if (!Array.isArray(addons) || addons.length === 0) {
    res
      .status(400)
      .json({ success: false, message: "Missing or empty addons array." });
    return;
  }
  // Validate each item in addons array
  for (const item of addons) {
    if (!item || typeof item !== "object") {
      res
        .status(400)
        .json({
          success: false,
          message: "Invalid item found in addons array.",
        });
      return;
    }
    if (!item.addonId || !mongoose.Types.ObjectId.isValid(item.addonId)) {
      res
        .status(400)
        .json({
          success: false,
          message: `Invalid or missing addonId in addon item: ${JSON.stringify(item)}`,
        });
      return;
    }
    if (
      typeof item.quantity !== "number" ||
      item.quantity < 1 ||
      !Number.isInteger(item.quantity)
    ) {
      res
        .status(400)
        .json({
          success: false,
          message: `Invalid or missing quantity (must be positive integer) in addon item: ${JSON.stringify(item)}`,
        });
      return;
    }
  }
  // --- End Validation ---

  try {
    // Pass the validated (but plain) body data to the service
    const result = await addonOrderService.initiateAddonOrder(userId, {
      originalOrderId,
      deliveryDate,
      addons, // Pass the validated addons array
    });

    res.status(200).json({
      success: true,
      message: "Payment intent created successfully.",
      data: result, // Contains clientSecret and addonOrderId
    });
  } catch (error) {
    console.error(
      "[AddonOrderController] Error initiating addon order payment:",
      error
    );
    // Ensure status code is set if possible before passing to global handler
    if (error instanceof Error && !(error as any).statusCode) {
      (error as any).statusCode = 500; // Default error
    }
    next(error); // Pass to Express error handler
  }
};
