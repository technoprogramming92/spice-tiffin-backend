// routes/package.routes.ts
import { Router } from "express";
import {
  createPackage,
  getAllPackages,
  updatePackage,
  deletePackage,
} from "../controllers/package.controller.js";
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

// @route   POST /api/v1/packages
router.post("/", catchAsync(createPackage));

// @route   GET /api/v1/packages
router.get("/", catchAsync(getAllPackages));

// @route   PUT /api/v1/packages/:id
router.put("/:id", catchAsync(updatePackage));

// @route   DELETE /api/v1/packages/:id
router.delete("/:id", catchAsync(deletePackage));

export default router;
