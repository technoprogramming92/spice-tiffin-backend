// src/services/delivery-date.service.ts
import {
  DeliveryDateSetting,
  IDeliveryDateSetting,
} from "../models/DeliveryDateSetting.model.js";
import mongoose from "mongoose";

// Helper to normalize date to UTC midnight
const normalizeDateUTC = (d: Date | string): Date => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export class DeliveryDateService {
  /**
   * Finds the next N available delivery dates on or after a given start date.
   */
  async getAvailableDates(startDate: Date, limit: number): Promise<Date[]> {
    console.log(
      `[DeliveryDateService] Finding ${limit} available dates starting from ${startDate.toISOString()}`
    );
    const normalizedStartDate = normalizeDateUTC(startDate);

    const availableSettings = await DeliveryDateSetting.find({
      date: { $gte: normalizedStartDate }, // On or after the start date
      isEnabled: true, // Must be enabled
    })
      .sort({ date: 1 }) // Get the earliest dates first
      .limit(limit) // Limit to the number needed
      .select("date") // Only select the date field
      .lean(); // Use lean for performance

    console.log(
      `[DeliveryDateService] Found ${availableSettings.length} available dates.`
    );
    return availableSettings.map((setting) => setting.date);
  }

  /**
   * Gets all settings for a specific month and year (for Admin UI).
   */
  async getSettingsForMonth(
    year: number,
    month: number
  ): Promise<Array<{ date: Date; isEnabled: boolean }>> {
    console.log(`[DeliveryDateService] Fetching settings for ${year}-${month}`);
    // Month in JavaScript Date is 0-indexed (0=Jan, 11=Dec)
    const startDate = new Date(Date.UTC(year, month - 1, 1)); // First day of month (UTC)
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // Last day of month (UTC)

    const settings = await DeliveryDateSetting.find({
      date: { $gte: startDate, $lte: endDate },
    })
      .select("date isEnabled")
      .lean();

    console.log(
      `[DeliveryDateService] Found ${settings.length} settings for ${year}-${month}.`
    );
    return settings.map((s) => ({ date: s.date, isEnabled: s.isEnabled }));
  }

  /**
   * Updates or creates a setting for a specific date (Admin action).
   */
  async updateDeliveryDateSetting(
    date: Date,
    isEnabled: boolean,
    notes?: string
  ): Promise<IDeliveryDateSetting> {
    const normalizedDate = normalizeDateUTC(date);
    console.log(
      `[DeliveryDateService] Updating setting for date ${normalizedDate.toISOString()} to isEnabled=${isEnabled}`
    );

    const update: Partial<IDeliveryDateSetting> = { isEnabled };
    if (notes !== undefined) {
      update.notes = notes;
    }

    // Find existing or create new (upsert)
    const setting = await DeliveryDateSetting.findOneAndUpdate(
      { date: normalizedDate },
      { $set: update, $setOnInsert: { date: normalizedDate } }, // Set date only on insert
      { new: true, upsert: true, runValidators: true }
    );

    if (!setting) {
      // Should not happen with upsert: true unless there's a major issue
      throw new Error(
        `Failed to update or create setting for date ${normalizedDate.toISOString()}`
      );
    }
    console.log(
      `[DeliveryDateService] Setting updated/created for ${normalizedDate.toISOString()}`
    );
    return setting;
  }

  // Optional: Bulk update function if needed later
  // async bulkUpdateDeliveryDates(updates: { date: Date, isEnabled: boolean }[]) { ... }
}

export const deliveryDateService = new DeliveryDateService();
