// src/controllers/operationalDate.controller.ts

import { Request, Response, NextFunction } from "express";
import { OperationalDateService } from "../services/operationalDate.service.js";
import { catchAsync } from "../utils/catchAsync.js"; // Assuming you have a catchAsync utility
import { Types } from "mongoose";

// Interface for the request body when setting multiple dates
interface SetOperationalDatesRequestBody {
  dates: Array<{
    date: string; // YYYY-MM-DD
    isDeliveryEnabled: boolean;
    notes?: string;
  }>;
}

// Interface for the request body when setting a single date via PUT
interface SetSingleOperationalDateRequestBody {
  isDeliveryEnabled: boolean;
  notes?: string;
}

export const setOperationalDatesHandler = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dates } = req.body as SetOperationalDatesRequestBody;
    // Assuming adminId is available on req.user from auth middleware
    const adminId = req.adminId; // Adjust based on your auth middleware

    if (!adminId) {
      // This should ideally not happen if protectAdmin runs correctly
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Admin ID not found on request.",
      });
    }

    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Dates array is required and cannot be empty.",
      });
    }

    const payloadWithAdmin = dates.map((d) => ({ ...d, adminId }));

    const updatedOperationalDates =
      await OperationalDateService.setOperationalDates(payloadWithAdmin);
    res.status(200).json({
      success: true,
      message: "Operational dates set successfully.",
      data: updatedOperationalDates,
    });
  }
);

export const getOperationalDatesInRangeHandler = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { startDate, endDate } = req.query;

    if (
      !startDate ||
      !endDate ||
      typeof startDate !== "string" ||
      typeof endDate !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate query parameters are required.",
      });
    }

    const operationalDates =
      await OperationalDateService.getOperationalDatesInRange({
        startDate,
        endDate,
      });
    res.status(200).json({
      success: true,
      message: "Operational dates fetched successfully.",
      data: operationalDates,
    });
  }
);

export const getSingleOperationalDateHandler = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dateString } = req.params; // e.g., "2025-12-31"

    const operationalDate =
      await OperationalDateService.getOperationalDateStatus(dateString);

    if (!operationalDate) {
      // If no explicit setting, you might want to return a default
      // or let the frontend decide. For now, just indicate it's not set.
      return res.status(200).json({
        // Changed to 200 as it's not an error, just no specific setting found
        success: true,
        message: "No specific operational setting for this date.",
        data: null, // Or a default object: { date: dateString, isDeliveryEnabled: false (or true based on general policy) }
      });
    }

    res.status(200).json({
      success: true,
      message: "Operational date status fetched successfully.",
      data: operationalDate,
    });
  }
);

export const updateSingleOperationalDateHandler = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dateString } = req.params;
    const { isDeliveryEnabled, notes } =
      req.body as SetSingleOperationalDateRequestBody;
    const adminId = req.adminId;

    if (typeof isDeliveryEnabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isDeliveryEnabled (boolean) is required in the request body.",
      });
    }

    const payload = [
      {
        date: dateString,
        isDeliveryEnabled,
        notes,
        adminId,
      },
    ];

    const updatedDate =
      await OperationalDateService.setOperationalDates(payload);

    res.status(200).json({
      success: true,
      message: `Operational status for ${dateString} updated successfully.`,
      data: updatedDate[0] || null, // setOperationalDates returns an array
    });
  }
);
