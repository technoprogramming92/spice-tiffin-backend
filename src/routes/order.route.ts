// src/routes/admin-order.route.ts
import { Router } from "express";
import {
  getAllOrders, // Controller for list view
  getAdminOrderById, // Controller for single view
  updateAdminOrder, // Controller for update
  deleteAdminOrder, // Controller for delete
} from "../controllers/order.controller.js"; // Import ALL needed controllers
import { protectAdmin } from "../middlewares/adminAuthMiddleware.js";
import { catchAsync } from "../utils/catchAsync.js"; // Assuming you use this

const router = Router();

// Apply admin protection to all routes in this file
router.use(protectAdmin);

// GET /api/v1/admin/orders (List with pagination/filter)
router.get("/", catchAsync(getAllOrders));

// GET /api/v1/admin/orders/:orderId (Single order)
router.get("/:orderId", catchAsync(getAdminOrderById));

// PUT /api/v1/admin/orders/:orderId (Update order)
router.put("/:orderId", catchAsync(updateAdminOrder));

// DELETE /api/v1/admin/orders/:orderId (Delete order)
router.delete("/:orderId", catchAsync(deleteAdminOrder));

export default router;
