// src/services/deliveryDate.service.ts

import { OperationalDateService } from "./operationalDate.service.js"; // Import the service we created
import { addDays, startOfDay } from "date-fns";
import { AppError } from "../utils/AppError.js";
import logger from "../config/logger.js"; // Assuming logger exists

/**
 * @class DeliveryDateService
 * @description Calculates valid delivery dates based on admin-defined operational days.
 */
export class DeliveryDateService {
  /**
   * Calculates the next N available delivery dates starting from a given date.
   * Availability is determined solely by checking OperationalDate entries where isDeliveryEnabled is true.
   *
   * @param firstPossibleStart Search for available dates starting from this date (inclusive).
   * @param numberOfDeliveries The number of delivery dates to find.
   * @param maxSearchDays The maximum number of future days to search before giving up. Prevents infinite loops.
   * @returns Promise<Date[]> Array of Date objects (normalized to UTC midnight) for the scheduled deliveries.
   * @throws AppError if not enough delivery dates can be found within the search window.
   */
  static async getAvailableDates(
    firstPossibleStart: Date,
    numberOfDeliveries: number,
    maxSearchDays: number = 90 // Default search limit (e.g., 3 months)
  ): Promise<Date[]> {
    const scheduledDates: Date[] = [];
    let currentDate = startOfDay(firstPossibleStart); // Normalize start date

    logger.debug(
      `[DeliveryDateService] Calculating ${numberOfDeliveries} dates starting from ${currentDate.toISOString()}. Max search: ${maxSearchDays} days.`
    );

    for (
      let daysSearched = 0;
      scheduledDates.length < numberOfDeliveries &&
      daysSearched <= maxSearchDays;
      daysSearched++
    ) {
      const dateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format

      try {
        // Check if this specific date is enabled in OperationalDate collection
        // OPTIMIZATION NOTE: Fetching one by one can be slow. Fetching a range
        // from OperationalDateService and checking in memory might be faster if
        // numberOfDeliveries or maxSearchDays is large. Let's keep it simple first.
        const operationalStatus =
          await OperationalDateService.getOperationalDateStatus(dateString);

        if (operationalStatus?.isDeliveryEnabled) {
          logger.debug(
            `[DeliveryDateService] Found available date: ${dateString}`
          );
          scheduledDates.push(new Date(currentDate)); // Store the normalized date
        } else {
          logger.debug(
            `[DeliveryDateService] Date ${dateString} is NOT operational.`
          );
        }
      } catch (error) {
        // Log error fetching status for a specific date but continue searching
        logger.error(
          `[DeliveryDateService] Error checking status for ${dateString}: ${error instanceof Error ? error.message : error}`
        );
        // Decide if we should stop or continue based on the error type?
        // For now, we continue to the next day.
      }

      // Move to the next day
      currentDate = startOfDay(addDays(currentDate, 1));
    }

    // Check if we found enough dates
    if (scheduledDates.length < numberOfDeliveries) {
      logger.error(
        `[DeliveryDateService] Could only find ${scheduledDates.length} of ${numberOfDeliveries} required delivery dates within ${maxSearchDays} days.`
      );
      throw new AppError(
        `Unable to schedule all ${numberOfDeliveries} deliveries within the next ${maxSearchDays} days. Please check operational date settings.`,
        400 // Bad Request or maybe 500 Internal Server Error depending on context
      );
    }

    logger.info(
      `[DeliveryDateService] Successfully calculated ${scheduledDates.length} delivery dates.`
    );
    return scheduledDates;
  }
}
