// src/controllers/delivery-date.controller.ts
import { Request, Response, NextFunction } from "express";
import { deliveryDateService } from "../services/delivery-date.service.js";

/**
 * @description Gets all delivery date settings for a given month/year (Admin).
 * @route GET /api/v1/admin/delivery-dates?year=YYYY&month=M
 * @access Private (Admin)
 */
export const getAdminSettingsForMonth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid year or month parameter." });
    }

    const settings = await deliveryDateService.getSettingsForMonth(year, month);
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

/**
 * @description Updates (or creates) the setting for a specific date (Admin).
 * @route PUT /api/v1/admin/delivery-dates
 * @access Private (Admin)
 */
export const updateAdminSetting = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { date: dateString, isEnabled, notes } = req.body;

    // Validate input
    if (!dateString || typeof isEnabled !== "boolean") {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Missing or invalid parameters: date and isEnabled (boolean) are required.",
        });
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid date format." });
    }

    const setting = await deliveryDateService.updateDeliveryDateSetting(
      date,
      isEnabled,
      notes
    );
    res
      .status(200)
      .json({ success: true, message: "Setting updated.", data: setting });
  } catch (error) {
    next(error);
  }
};

/**
 * @description Gets publicly available future delivery dates.
 * @route GET /api/v1/delivery-dates/available?from=YYYY-MM-DD&limit=N
 * @access Public
 */
export const getPublicAvailableDates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const fromDateStr = (req.query.from as string) || new Date().toISOString(); // Default to today
    const limit = parseInt(req.query.limit as string) || 10; // Default limit
    const startDate = new Date(fromDateStr);

    if (isNaN(startDate.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid "from" date format.' });
    }

    const availableDates = await deliveryDateService.getAvailableDates(
      startDate,
      limit
    );
    res.status(200).json({ success: true, data: availableDates });
  } catch (error) {
    next(error);
  }
};
