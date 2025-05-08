// src/routes/operationalDate.routes.ts

import { Router } from "express";
import {
  setOperationalDatesHandler,
  getOperationalDatesInRangeHandler,
  getSingleOperationalDateHandler,
  updateSingleOperationalDateHandler,
} from "../controllers/operationalDate.controller.js";
import { protectAdmin } from "../middlewares/adminAuthMiddleware.js"; // Placeholder for your admin auth

const router = Router();

// All routes in this module should be admin protected
router.use(protectAdmin); // Apply admin auth to all routes below

/**
 * @route   POST /api/v1/operational-dates/batch
 * @desc    Set or update multiple operational delivery dates
 * @access  Private (Admin)
 */
router.post("/batch", setOperationalDatesHandler);

/**
 * @route   GET /api/v1/operational-dates
 * @desc    Get operational delivery dates within a specified range
 * @access  Private (Admin)
 * @query   startDate=YYYY-MM-DD, endDate=YYYY-MM-DD
 */
router.get("/", getOperationalDatesInRangeHandler);

/**
 * @route   GET /api/v1/operational-dates/:dateString
 * @desc    Get operational status for a single date (YYYY-MM-DD)
 * @access  Private (Admin)
 */
router.get("/:dateString", getSingleOperationalDateHandler);

/**
 * @route   PUT /api/v1/operational-dates/:dateString
 * @desc    Update operational status for a single date (YYYY-MM-DD)
 * @access  Private (Admin)
 */
router.put("/:dateString", updateSingleOperationalDateHandler);

export default router;
