// controllers/package.controller.ts
import { Request, Response } from "express";
import { Package } from "../models/Package.model.js";
import {
  createPackageSchema,
  updatePackageSchema,
} from "../validators/packageSchema.js";

export const createPackage = async (req: Request, res: Response) => {
  const parsed = createPackageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      error: parsed.error.errors,
    });
  }

  try {
    const newPackage = await Package.create(parsed.data);
    const populatedPackage = await Package.findById(newPackage._id).populate(
      "category",
      "name _id"
    );
    return res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: populatedPackage,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error creating package",
      error: err,
    });
  }
};

export const getAllPackages = async (_req: Request, res: Response) => {
  try {
    const packages = await Package.find()
      .populate("category", "name _id")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      message: "Packages fetched successfully",
      data: packages,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error fetching packages",
      error: err,
    });
  }
};

export const updatePackage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = updatePackageSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      error: parsed.error.errors,
    });
  }

  try {
    const updated = await Package.findByIdAndUpdate(id, parsed.data, {
      new: true,
    }).populate("category", "name _id");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Package updated successfully",
      data: updated,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error updating package",
      error: err,
    });
  }
};

export const deletePackage = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deleted = await Package.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Package deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error deleting package",
      error: err,
    });
  }
};
