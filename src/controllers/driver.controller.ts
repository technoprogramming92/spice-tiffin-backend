// src/controllers/driver.controller.ts

import { Request, Response } from "express";
import { Driver } from "../models/Driver.model.js"; // Adjust path
import {
  createDriverSchema,
  updateDriverSchema,
  // driverIdParamSchema might not be used directly here if validated earlier
} from "../validators/driverSchema.js"; // Adjust path
import mongoose from "mongoose"; // Needed for ObjectId validation potentially

/**
 * @description Create a new driver
 * @route POST /api/v1/drivers
 * @access Private (Assumed: Admin only - protection must be applied before this route)
 */
export const createDriver = async (req: Request, res: Response) => {
  // 1. Validate request body
  const parsed = createDriverSchema.safeParse({ body: req.body }); // Validate the body structure
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors, // Send flattened errors
    });
  }

  try {
    // 2. Create driver (password hashing handled by model's pre-save hook)
    const newDriver = await Driver.create(parsed.data.body);

    // 3. Prepare response (exclude password)
    const driverResponse = newDriver.toObject();
    delete driverResponse.password;

    return res.status(201).json({
      success: true,
      message: "Driver created successfully.",
      data: driverResponse,
    });
  } catch (error: any) {
    console.error("[DriverController] Error creating driver:", error);
    // Handle potential duplicate key error (phone number)
    if (error.code === 11000 && error.keyPattern?.phone) {
      return res.status(409).json({
        // 409 Conflict is suitable here
        success: false,
        message: `Phone number '${error.keyValue.phone}' is already registered.`,
      });
    }
    // Handle other potential errors
    return res.status(500).json({
      success: false,
      message: "Error creating driver",
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
};

/**
 * @description Get all drivers
 * @route GET /api/v1/drivers
 * @access Private (Assumed: Admin only - protection must be applied before this route)
 */
export const getAllDrivers = async (req: Request, res: Response) => {
  try {
    // TODO: Implement filtering, sorting, pagination based on req.query if needed
    const drivers = await Driver.find({}).sort({ createdAt: -1 }); // Excludes password by default

    return res.status(200).json({
      success: true,
      message: "Drivers fetched successfully.",
      count: drivers.length,
      data: drivers,
    });
  } catch (error: any) {
    console.error("[DriverController] Error fetching all drivers:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching drivers",
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
};

/**
 * @description Get a single driver by ID
 * @route GET /api/v1/drivers/:id
 * @access Private (Assumed: Admin only - protection must be applied before this route)
 */
export const getDriverById = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Optional: Validate ID format early
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid driver ID format." });
  }

  try {
    const driver = await Driver.findById(id); // Excludes password by default

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Driver fetched successfully.",
      data: driver,
    });
  } catch (error: any) {
    console.error(`[DriverController] Error fetching driver ${id}:`, error);
    return res.status(500).json({
      success: false,
      message: "Error fetching driver",
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
};

/**
 * @description Update a driver by ID
 * @route PATCH /api/v1/drivers/:id
 * @access Private (Assumed: Admin only - protection must be applied before this route)
 */
export const updateDriver = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Optional: Validate ID format early
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid driver ID format." });
  }

  // 1. Validate request body
  // Note: updateDriverSchema expects { body: ..., params: ... } structure
  // We parse only the body here. Param validation assumed done earlier or implicitly via ID check.
  const parsed = updateDriverSchema.safeParse({
    body: req.body,
    params: req.params,
  });
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  // Extract validated body data
  const updateData = parsed.data.body;

  // Check if update data is empty (optional, Zod refine should handle this)
  if (Object.keys(updateData).length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No update data provided." });
  }

  try {
    // 2. Find and update (password hashing handled by pre-save hook if password is in updateData)
    const updatedDriver = await Driver.findByIdAndUpdate(id, updateData, {
      new: true, // Return the modified document
      runValidators: true, // Ensure schema validators run on update
    });

    if (!updatedDriver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // 3. Prepare response (exclude password)
    const driverResponse = updatedDriver.toObject();
    delete driverResponse.password;

    return res.status(200).json({
      success: true,
      message: "Driver updated successfully.",
      data: driverResponse,
    });
  } catch (error: any) {
    console.error(`[DriverController] Error updating driver ${id}:`, error);
    // Handle potential duplicate key error (phone number) on update
    if (error.code === 11000 && error.keyPattern?.phone) {
      return res.status(409).json({
        // 409 Conflict
        success: false,
        message: `Phone number '${error.keyValue.phone}' is already registered.`,
      });
    }
    // Handle Mongoose validation errors during update
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((el: any) => el.message);
      return res.status(400).json({
        success: false,
        message: `Invalid input data. ${messages.join(". ")}`,
      });
    }
    // Generic error
    return res.status(500).json({
      success: false,
      message: "Error updating driver",
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
};

/**
 * @description Delete a driver by ID
 * @route DELETE /api/v1/drivers/:id
 * @access Private (Assumed: Admin only - protection must be applied before this route)
 */
export const deleteDriver = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Optional: Validate ID format early
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid driver ID format." });
  }

  try {
    const deleted = await Driver.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Standard practice is to return 204 No Content on successful DELETE
    // return res.status(204).send();
    // Or return a confirmation message as per package.controller example:
    return res.status(200).json({
      success: true,
      message: "Driver deleted successfully",
      // Optionally return the deleted ID or object (without password)
      // data: { _id: deleted._id }
    });
  } catch (error: any) {
    console.error(`[DriverController] Error deleting driver ${id}:`, error);
    return res.status(500).json({
      success: false,
      message: "Error deleting driver",
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
};
