// routes/city.route.ts
import { Router } from "express";
import {
  createCity,
  getAllCities,
  updateCity,
  deleteCity,
} from "../controllers/city.controller.js";
import { protectAdmin } from "../middlewares/adminAuthMiddleware.js"; // Use ADMIN protection
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

// --- Public or Customer/Admin Route ---
/**
 * @route   GET /api/v1/cities
 * @desc    Get all available delivery cities
 * @access  Public (or apply 'protect'/'protectAdmin' if needed)
 */
router.get("/", catchAsync(getAllCities)); // Currently public

// --- Admin Only Routes ---
/**
 * @route   POST /api/v1/cities
 * @desc    Create a new delivery city
 * @access  Private (Admin)
 */
router.post("/", protectAdmin, catchAsync(createCity));

/**
 * @route   PUT /api/v1/cities/:id
 * @desc    Update an existing delivery city
 * @access  Private (Admin)
 */
router.put("/:id", protectAdmin, catchAsync(updateCity));

/**
 * @route   DELETE /api/v1/cities/:id
 * @desc    Delete a delivery city
 * @access  Private (Admin)
 */
router.delete("/:id", protectAdmin, catchAsync(deleteCity));

export default router;
