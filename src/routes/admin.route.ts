import { Router } from "express";
import { adminLogin } from "../controllers/admin.controller.js";
import { catchAsync } from "../utils/catchAsync.js";
import { protectAdmin } from "../middlewares/adminAuthMiddleware.js";
import { getAllCustomers } from "../controllers/admin.controller.js";
const router = Router();

router.post("/login", catchAsync(adminLogin));

// --- NEW ROUTE for getting all customers ---
/**
 * @route   GET /api/v1/admin/customers
 * @desc    Get all customer records (for admin)
 * @access  Private (Admin)
 */
router.get(
  "/customers", // Path relative to /api/v1/admin
  protectAdmin, // Apply admin authentication middleware
  catchAsync(getAllCustomers) // Use the new controller function
);

export default router;
