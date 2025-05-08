// src/routes/admin-delivery-date.route.ts
import { Router } from "express";
import {
  getAdminSettingsForMonth,
  updateAdminSetting,
} from "../controllers/delivery-date.controller.js";
import { protectAdmin } from "../middlewares/adminAuthMiddleware.js"; // Your Admin guard
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

// All routes here require admin access
router.use(protectAdmin);

// GET /api/v1/admin/delivery-dates?year=YYYY&month=M
router.get("/", catchAsync(getAdminSettingsForMonth));

// PUT /api/v1/admin/delivery-dates
router.put("/", catchAsync(updateAdminSetting));

export default router;
