// src/routes/driver.route.ts

import { Router } from "express";
import {
  createDriver,
  getAllDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
} from "../controllers/driver.controller.js"; // Adjust path
import { catchAsync } from "../utils/catchAsync.js"; // Adjust path

const router = Router();

// @route   POST /api/v1/drivers
router.post("/", catchAsync(createDriver));

// @route   GET /api/v1/drivers
router.get("/", catchAsync(getAllDrivers));

// @route   GET /api/v1/drivers/:id
router.get("/:id", catchAsync(getDriverById));

// @route   PATCH /api/v1/drivers/:id  (Using PATCH for partial updates)
router.patch("/:id", catchAsync(updateDriver));

// @route   DELETE /api/v1/drivers/:id
router.delete("/:id", catchAsync(deleteDriver));

export default router;
