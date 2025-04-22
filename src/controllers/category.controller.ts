// src/controllers/category.controller.ts

import { Request, Response } from "express";
import { Category } from "../models/Category.model.js";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validators/categorySchema.js";

/**
 * @desc Create a new category
 */
export const createCategory = async (req: Request, res: Response) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid input data",
      errors: parsed.error.errors,
    });
  }

  const { name } = parsed.data;
  const existing = await Category.findOne({ name });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "Category already exists",
    });
  }

  const category = await Category.create({ name });
  return res
    .status(200)
    .json({ success: true, message: "Category created", data: category });
};

/**
 * @desc Get all categories
 */
export const getAllCategories = async (_req: Request, res: Response) => {
  const categories = await Category.find().sort({ createdAt: -1 }); // newest first
  return res.status(200).json({
    success: true,
    message: "Categories fetched successfully",
    categories,
  });
};

/**
 * @desc Update category by ID
 */
export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid update data",
      errors: parsed.error.errors,
    });
  }

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
};

/**
 * @desc Delete category by ID
 */
export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
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
};
