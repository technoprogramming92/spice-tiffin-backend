// routes/category.routes.ts
import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";

const router = Router();

function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// @route   POST /api/v1/categories
router.post("/", asyncHandler(createCategory));

// @route   GET /api/v1/categories
router.get("/", asyncHandler(getAllCategories));

// @route   PUT /api/v1/categories/:id
router.put("/:id", asyncHandler(updateCategory));

// @route   DELETE /api/v1/categories/:id
router.delete("/:id", asyncHandler(deleteCategory));

export default router;
