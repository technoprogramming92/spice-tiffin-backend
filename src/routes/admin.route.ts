import { Router } from "express";
import { adminLogin } from "../controllers/admin.controller.js";
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

router.post("/login", catchAsync(adminLogin));

export default router;
