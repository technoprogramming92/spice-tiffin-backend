// src/routes/delivery-date.route.ts
import { Router } from "express";
// import { getPublicAvailableDates } from "../controllers/delivery-date.controller.js";
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

// GET /api/v1/delivery-dates/available?from=YYYY-MM-DD&limit=N
// router.get("/available", catchAsync(getPublicAvailableDates));

export default router;
