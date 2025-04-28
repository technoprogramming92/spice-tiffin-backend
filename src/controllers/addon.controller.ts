// src/controllers/addon.controller.ts

import { Request, Response } from "express";
import Addon from "../models/addon.model"; // Adjust path if needed

// --- Assume you create these Zod schemas in ../validators/ ---
import {
  createAddonSchema, // Validates { name: string, price: number, image: string }
  updateAddonSchema, // Validates { name?: string, price?: number, image?: string } - fields are optional
} from "../validators/addonSchema"; // Adjust path if needed
// -------------------------------------------------------------

// --- Create a new Addon ---
export const createAddon = async (req: Request, res: Response) => {
  // 1. Validate request body
  const parsed = createAddonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.errors, // Use 'errors' key like in category controller
    });
  }

  const { name, price, image } = parsed.data;

  try {
    // 2. Check if addon with the same name already exists (assuming name should be unique)
    const exists = await Addon.findOne({ name });
    if (exists) {
      return res
        .status(409) // 409 Conflict
        .json({
          success: false,
          message: `Addon with name '${name}' already exists`,
        });
    }

    // 3. Create the addon
    // Assumes 'image' in parsed.data is the final URL/path
    const addon = await Addon.create({ name, price, image });

    // 4. Send success response
    return res.status(201).json({
      success: true,
      message: "Addon created successfully",
      data: addon,
    });
  } catch (err: any) {
    // Use 'any' or a more specific error type
    console.error("Server error creating addon:", err); // Log the actual error
    // 5. Handle generic server errors
    return res.status(500).json({
      success: false,
      message: "Server error while creating addon",
      error: err.message, // Send error message
    });
  }
};

// --- Get all Addons ---
export const getAllAddons = async (_req: Request, res: Response) => {
  try {
    // Fetch addons, sort by name (or createdAt, adjust as needed)
    const addons = await Addon.find().sort({ name: 1 }); // Sort alphabetically by name

    return res.status(200).json({
      success: true,
      // message: "Addons fetched successfully", // Optional: message can be omitted on successful GET all
      count: addons.length, // Add count for convenience
      data: addons,
    });
  } catch (err: any) {
    console.error("Server error fetching addons:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching addons",
      error: err.message,
    });
  }
};

// --- Get a single Addon by ID ---
export const getAddonById = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Optional: Basic check for valid ID format before hitting DB
  // if (!mongoose.Types.ObjectId.isValid(id)) {
  //    return res.status(400).json({ success: false, message: 'Invalid Addon ID format' });
  // }

  try {
    const addon = await Addon.findById(id);

    if (!addon) {
      return res.status(404).json({
        success: false,
        message: "Addon not found",
      });
    }

    return res.status(200).json({
      success: true,
      // message: 'Addon fetched successfully', // Optional message
      data: addon,
    });
  } catch (err: any) {
    console.error(`Server error fetching addon with ID ${id}:`, err);
    // Handle CastError specifically if needed, otherwise caught by generic 500
    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: `Invalid Addon ID format: ${id}` });
    }
    return res.status(500).json({
      success: false,
      message: "Error fetching addon",
      error: err.message,
    });
  }
};

// --- Update an Addon by ID ---
export const updateAddon = async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Validate request body
  const parsed = updateAddonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.errors,
    });
  }

  // Ensure there's actually data to update
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No update data provided.",
    });
  }

  try {
    // Check if updating name to one that already exists (excluding itself)
    if (parsed.data.name) {
      const existingAddon = await Addon.findOne({
        name: parsed.data.name,
        _id: { $ne: id },
      });
      if (existingAddon) {
        return res.status(409).json({
          success: false,
          message: `Another addon with name '${parsed.data.name}' already exists.`,
        });
      }
    }

    // 2. Find and update the addon
    const updatedAddon = await Addon.findByIdAndUpdate(
      id,
      parsed.data, // Contains validated { name?, price?, image? }
      { new: true, runValidators: true } // Return updated doc, run schema validation
    );

    // 3. Check if addon was found and updated
    if (!updatedAddon) {
      return res.status(404).json({
        success: false,
        message: "Addon not found",
      });
    }

    // 4. Send success response
    return res.status(200).json({
      success: true,
      message: "Addon updated successfully",
      data: updatedAddon,
    });
  } catch (err: any) {
    console.error(`Server error updating addon with ID ${id}:`, err);
    // Handle CastError specifically if needed
    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: `Invalid Addon ID format: ${id}` });
    }
    // 5. Handle generic server errors
    return res.status(500).json({
      success: false,
      message: "Error updating addon",
      error: err.message,
    });
  }
};

// --- Delete an Addon by ID ---
export const deleteAddon = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Optional: Basic check for valid ID format
  // if (!mongoose.Types.ObjectId.isValid(id)) {
  //    return res.status(400).json({ success: false, message: 'Invalid Addon ID format' });
  // }

  try {
    // 1. Find and delete the addon
    const deletedAddon = await Addon.findByIdAndDelete(id);

    // 2. Check if addon was found and deleted
    if (!deletedAddon) {
      return res.status(404).json({
        success: false,
        message: "Addon not found",
      });
    }

    // TODO: Add logic here to delete the associated image file
    // from your cloud storage (S3, Cloudinary, etc.) or local filesystem
    // using deletedAddon.image URL/path if necessary.

    // 3. Send success response
    return res.status(200).json({
      success: true,
      message: "Addon deleted successfully",
      // No data needed on successful delete
    });
  } catch (err: any) {
    console.error(`Server error deleting addon with ID ${id}:`, err);
    // Handle CastError specifically if needed
    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: `Invalid Addon ID format: ${id}` });
    }
    // 4. Handle generic server errors
    return res.status(500).json({
      success: false,
      message: "Error deleting addon",
      error: err.message,
    });
  }
};
