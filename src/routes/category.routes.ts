import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

router.post("/", catchAsync(createCategory));
router.get("/", catchAsync(getAllCategories));
router.put("/:id", catchAsync(updateCategory));
router.delete("/:id", catchAsync(deleteCategory));

export default router;
