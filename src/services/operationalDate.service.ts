// src/services/operationalDate.service.ts

import {
  OperationalDate,
  IOperationalDate,
} from "../models/OperationalDate.model.js";
import { Types } from "mongoose";
import { AppError } from "../utils/AppError.js"; // Assuming you have a custom error class

interface IOperationalDatePayload {
  date: string; // Expecting YYYY-MM-DD string
  isDeliveryEnabled: boolean;
  notes?: string | null; // Allow null to signify unsetting
  adminId?: Types.ObjectId | string;
}

interface IDateRangeParams {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

/**
 * @class OperationalDateService
 * @description Service for managing operational delivery dates set by admins.
 */
export class OperationalDateService {
  /**
   * @description Sets or updates multiple operational dates.
   * @param {IOperationalDatePayload[]} datesPayload - Array of date settings.
   * @returns {Promise<IOperationalDate[]>} - The created or updated operational date documents.
   */
  static async setOperationalDates(
    datesPayload: IOperationalDatePayload[]
  ): Promise<IOperationalDate[]> {
    if (!datesPayload || datesPayload.length === 0) {
      throw new AppError("No date payloads provided.", 400);
    }

    const operations = datesPayload.map((payload) => {
      const normalizedDate = new Date(payload.date);
      if (isNaN(normalizedDate.getTime())) {
        throw new AppError(
          `Invalid date format provided: ${payload.date}`,
          400
        );
      }
      normalizedDate.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight

      // Initialize the update object for MongoDB
      const mongoUpdateObject: {
        $set: Partial<IOperationalDate>;
        $unset?: { notes?: "" };
        $setOnInsert?: any;
      } = {
        $set: {},
      };

      // Populate $set
      mongoUpdateObject.$set.isDeliveryEnabled = payload.isDeliveryEnabled;
      if (payload.adminId) {
        mongoUpdateObject.$set.setBy = new Types.ObjectId(payload.adminId);
      }
      if (payload.notes && payload.notes.trim() !== "") {
        mongoUpdateObject.$set.notes = payload.notes;
      } else if (payload.notes === null || payload.notes === "") {
        // Ensure $unset operator is initialized if not already
        if (!mongoUpdateObject.$unset) {
          mongoUpdateObject.$unset = {};
        }
        mongoUpdateObject.$unset.notes = ""; // Standard practice to set to "" for $unset
      }

      mongoUpdateObject.$setOnInsert = {
        date: normalizedDate, // Ensures date is set on insert
      };
      return {
        updateOne: {
          filter: { date: normalizedDate },
          update: mongoUpdateObject, // Use the correctly structured mongoUpdateObject
          upsert: true,
        },
      };
    });

    const result = await OperationalDate.bulkWrite(operations);

    // Fetch the updated/created documents to return them
    // This is an extra step but provides the actual documents back
    const affectedDates = datesPayload.map((payload) => {
      const normalizedDate = new Date(payload.date);
      normalizedDate.setUTCHours(0, 0, 0, 0);
      return normalizedDate;
    });

    const updatedDocs = await OperationalDate.find({
      date: { $in: affectedDates },
    });

    if (
      result.upsertedCount + result.modifiedCount < datesPayload.length &&
      result.matchedCount < datesPayload.length
    ) {
      console.warn(
        `[OperationalDateService] BulkWrite operation summary: 
            Upserted: ${result.upsertedCount}, 
            Modified: ${result.modifiedCount}, 
            Matched: ${result.matchedCount}. 
            Payloads sent: ${datesPayload.length}. Some operations might not have changed documents if values were the same, or some might have failed if part of a larger transaction that rolled back (not applicable here as it's individual ops).`
      );
    }

    return updatedDocs;
  }

  /**
   * @description Retrieves operational dates within a given date range.
   * @param {IDateRangeParams} params - Start and end date for the range.
   * @returns {Promise<IOperationalDate[]>} - Array of operational date documents.
   */
  static async getOperationalDatesInRange(
    params: IDateRangeParams
  ): Promise<IOperationalDate[]> {
    const startDate = new Date(params.startDate);
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(params.endDate);
    endDate.setUTCHours(0, 0, 0, 0); // Ensure end of day for endDate

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new AppError("Invalid start or end date format.", 400);
    }
    if (startDate > endDate) {
      throw new AppError("Start date cannot be after end date.", 400);
    }

    return OperationalDate.find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({ date: "asc" });
  }

  /**
   * @description Retrieves the operational status for a single specific date.
   * @param {string} dateString - The date string (YYYY-MM-DD).
   * @returns {Promise<IOperationalDate | null>} - The operational date document or null if not set.
   */
  static async getOperationalDateStatus(
    dateString: string
  ): Promise<IOperationalDate | null> {
    const queryDate = new Date(dateString);
    if (isNaN(queryDate.getTime())) {
      throw new AppError(`Invalid date format provided: ${dateString}`, 400);
    }
    queryDate.setUTCHours(0, 0, 0, 0);

    return OperationalDate.findOne({ date: queryDate });
  }
}
