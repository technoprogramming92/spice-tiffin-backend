// controllers/category.controller.ts
import { Request, Response } from "express";
import { Category } from "../models/Category.model.js";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validators/categorySchema.js";

export const createCategory = async (req: Request, res: Response) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      error: parsed.error.errors,
    });
  }

  const { name } = parsed.data;

  try {
    const exists = await Category.findOne({ name });
    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: "Category already exists" });
    }

    const category = await Category.create({ name });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error while creating category",
      error: err,
    });
  }
};

export const getAllCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find().sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categories,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: err,
    });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = updateCategorySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      error: parsed.error.errors,
    });
  }

  try {
    const updated = await Category.findByIdAndUpdate(id, parsed.data, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updated,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error updating category",
      error: err,
    });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deleted = await Category.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error deleting category",
      error: err,
    });
  }
};
