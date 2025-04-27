// controllers/city.controller.ts
import { Request, Response, NextFunction } from "express";
import { City } from "../models/City.model.js";
import {
  createCitySchema,
  updateCitySchema,
} from "../validators/citySchema.js";

/**
 * @description Create a new delivery city.
 * @route POST /api/v1/cities
 * @access Private (Admin)
 */
export const createCity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Validate request body
    const parsed = createCitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    const { name } = parsed.data;

    // 2. Check if city already exists (case-insensitive check recommended)
    const existingCity = await City.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });
    if (existingCity) {
      res.status(409).json({
        // 409 Conflict
        success: false,
        message: `City '${name}' already exists.`,
      });
      return;
    }

    // 3. Create and save the new city
    const newCity = await City.create({ name }); // Mongoose handles required/unique from schema

    console.log(
      `[CityController] City created: ${newCity.name} (ID: ${newCity._id})`
    );
    res.status(201).json({
      success: true,
      message: "City created successfully.",
      data: newCity,
    });
  } catch (error) {
    console.error("[CityController] Error creating city:", error);
    // Pass error to global handler
    next(error);
  }
};

/**
 * @description Get all available delivery cities.
 * @route GET /api/v1/cities
 * @access Public or Private (Admin/Customer - Apply middleware in route if needed)
 */
export const getAllCities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log(`[CityController] Fetching all cities...`);
    // Fetch all cities, sort alphabetically by name
    const cities = await City.find({}).sort({ name: 1 });

    console.log(`[CityController] Found ${cities.length} cities.`);
    res.status(200).json({
      success: true,
      message: "Cities fetched successfully.",
      count: cities.length,
      data: cities,
    });
  } catch (error) {
    console.error("[CityController] Error fetching cities:", error);
    next(error);
  }
};

/**
 * @description Update an existing delivery city.
 * @route PUT /api/v1/cities/:id
 * @access Private (Admin)
 */
export const updateCity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params; // Get city ID from URL parameters

    // 1. Validate request body
    const parsed = updateCitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    const updateData = parsed.data;

    // 2. Check if data is empty (nothing to update)
    if (Object.keys(updateData).length === 0) {
      res
        .status(400)
        .json({ success: false, message: "No update data provided." });
      return;
    }

    // 3. Check if the new name (if provided) already exists (excluding the current city)
    if (updateData.name) {
      const existingCity = await City.findOne({
        name: { $regex: `^${updateData.name}$`, $options: "i" },
        _id: { $ne: id }, // Exclude the document being updated
      });
      if (existingCity) {
        res
          .status(409)
          .json({
            success: false,
            message: `Another city with name '${updateData.name}' already exists.`,
          });
        return;
      }
    }

    // 4. Find and update the city
    const updatedCity = await City.findByIdAndUpdate(
      id,
      { $set: updateData }, // Use $set to only update provided fields
      { new: true, runValidators: true } // Return updated doc, run schema validators
    );

    // 5. Handle not found
    if (!updatedCity) {
      const error = new Error(`City with ID ${id} not found.`);
      (error as any).statusCode = 404;
      return next(error); // Pass to error handler
    }

    console.log(
      `[CityController] City updated: ${updatedCity.name} (ID: ${updatedCity._id})`
    );
    res.status(200).json({
      success: true,
      message: "City updated successfully.",
      data: updatedCity,
    });
  } catch (error) {
    console.error("[CityController] Error updating city:", error);
    next(error);
  }
};

/**
 * @description Delete a delivery city.
 * @route DELETE /api/v1/cities/:id
 * @access Private (Admin)
 */
export const deleteCity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params; // Get city ID from URL parameters

    // TODO: Add check here - prevent deletion if city is currently linked to active Packages/Orders/Customers?
    // This requires checking other collections and adds complexity. For now, direct delete.
    // Example check (pseudo-code):
    // const packagesInCity = await Package.countDocuments({ cityId: id }); // Assuming Package has cityId
    // if (packagesInCity > 0) {
    //      return res.status(400).json({ success: false, message: 'Cannot delete city with active packages.' });
    // }

    // 1. Find and delete the city
    const deletedCity = await City.findByIdAndDelete(id);

    // 2. Handle not found
    if (!deletedCity) {
      const error = new Error(`City with ID ${id} not found for deletion.`);
      (error as any).statusCode = 404;
      return next(error);
    }

    console.log(
      `[CityController] City deleted: ${deletedCity.name} (ID: ${deletedCity._id})`
    );
    // Send 200 OK with success message (or 204 No Content)
    res.status(200).json({
      success: true,
      message: "City deleted successfully.",
      data: null, // Or return the deleted city: data: deletedCity
    });
    // Alternative: res.status(204).send();
  } catch (error) {
    console.error("[CityController] Error deleting city:", error);
    next(error);
  }
};
