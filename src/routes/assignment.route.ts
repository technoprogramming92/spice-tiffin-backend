// src/routes/assignment.route.ts

import { Router } from "express";
import { protectAdmin } from "../middlewares/adminAuthMiddleware.js";
import {
  getAssignedOrders,
  assignOrdersToDriver,
} from "../controllers/assignment.controller.js";
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

// --- Apply Middleware (if not done globally in app.ts for admin routes) ---
// router.use(protect);
// router.use(restrictTo('admin'));

/**
 * @route   GET /api/v1/admin/assignments
 * @desc    Get orders assigned to a specific driver (via query param)
 * @access  Private (Admin only)
 * @query   driverId (required), status (optional)
 */
router.get("/", protectAdmin, catchAsync(getAssignedOrders));

router.post(
  "/",
  protectAdmin, // Apply necessary authentication/authorization
  // validate(assignmentSchema), // Optional: Add validation middleware if you have it
  catchAsync(assignOrdersToDriver) // Use the controller function that handles assignment
);

export default router;
