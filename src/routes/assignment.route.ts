// src/routes/assignment.route.ts

import { Router } from "express";
import { protectAdmin } from "../middlewares/adminAuthMiddleware.js";
import { getAssignedOrders } from "../controllers/assignment.controller.js";
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

// --- Add POST route for assigning orders here later ---
// router.post('/', protect, restrictTo('admin'), validate(assignmentSchema), assignOrdersToDriver);

export default router;
