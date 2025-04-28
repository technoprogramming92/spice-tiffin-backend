// src/routes/addon.routes.ts

import { Router, Request, Response, NextFunction } from "express";

// 1. Import Addon controller functions
import {
  createAddon,
  getAllAddons,
  getAddonById, // Added for fetching single addon
  updateAddon,
  deleteAddon,
} from "../controllers/addon.controller.js"; // Adjust path if needed, ensure '.js' if compiling

const router = Router();

// 2. Include the same asyncHandler utility
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return function (req: Request, res: Response, next: NextFunction): void {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// --- Define Addon Routes ---
// Note: Add authentication/authorization middleware here or when mounting
//       this router in your main app file, especially for POST, PUT, DELETE.

// @route   POST /api/v1/addons
// @desc    Create a new addon
// @access  Private (Admin likely)
router.post("/", asyncHandler(createAddon));

// @route   GET /api/v1/addons
// @desc    Get all addons
// @access  Public or Private (depending on your app)
router.get("/", asyncHandler(getAllAddons));

// @route   GET /api/v1/addons/:id
// @desc    Get a single addon by its ID
// @access  Public or Private
router.get("/:id", asyncHandler(getAddonById));

// @route   PUT /api/v1/addons/:id
// @desc    Update an existing addon by its ID
// @access  Private (Admin likely)
router.put("/:id", asyncHandler(updateAddon)); // Or use PATCH if appropriate

// @route   DELETE /api/v1/addons/:id
// @desc    Delete an addon by its ID
// @access  Private (Admin likely)
router.delete("/:id", asyncHandler(deleteAddon));

// 3. Export the router
export default router;
