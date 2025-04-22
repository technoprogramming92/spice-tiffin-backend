import express from "express";
import {
  createPackage,
  deletePackage,
  getAllPackages,
  getSinglePackage,
  updatePackage,
} from "../controllers/package.controller.js";
import { catchAsync } from "../utils/catchAsync.js";

const router = express.Router();

router.post("/", catchAsync(createPackage));
router.get("/", catchAsync(getAllPackages));
router.get("/:id", catchAsync(getSinglePackage));
router.put("/:id", catchAsync(updatePackage));
router.delete("/:id", catchAsync(deletePackage));

export default router;
