// controllers/customer.controller.ts
import { Request, Response, NextFunction } from "express";
import { Customer } from "../models/Customer.model.js";
import { updateProfileSchema } from "../validators/customerSchema.js";

/**
 * Get the profile of the currently authenticated customer.
 */
export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // userId should be attached by the 'protect' middleware
    const userId = req.userId;
    if (!userId) {
      // This shouldn't happen if middleware is applied correctly
      return res
        .status(401)
        .json({
          success: false,
          message: "Unauthorized: User ID not found on request",
        });
    }

    // Find the customer, excluding sensitive fields
    const customer = await Customer.findById(userId).select(
      "-password -otpCode -otpExpiresAt -otpSessionId -__v"
    );

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer profile not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: customer,
    });
  } catch (error) {
    next(error); // Pass error to the global error handler
  }
};

/**
 * Update the profile of the currently authenticated customer.
 */
export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Unauthorized: User ID not found on request",
        });
    }

    // Validate incoming data
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors, // Send specific field errors
      });
    }

    // Prepare update data - only include fields that were actually provided
    const updateData = parsed.data;

    // Find and update the customer
    const updatedCustomer = await Customer.findByIdAndUpdate(
      userId,
      { $set: updateData }, // Use $set to only update provided fields
      { new: true, runValidators: true } // Return updated doc, run schema validators
    ).select("-password -otpCode -otpExpiresAt -otpSessionId -__v"); // Exclude sensitive fields from response

    if (!updatedCustomer) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Customer profile not found for update",
        });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedCustomer, // Return the updated profile
    });
  } catch (error) {
    // Handle potential validation errors from Mongoose if runValidators catches something Zod missed
    if (error instanceof Error && error.name === "ValidationError") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Update failed validation",
          error: error.message,
        });
    }
    next(error); // Pass other errors to the global handler
  }
};
