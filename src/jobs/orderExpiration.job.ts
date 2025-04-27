// src/jobs/orderExpiration.job.ts
import cron from "node-cron";
import { Order, OrderStatus } from "../models/Order.model.js";

/**
 * Finds active orders whose end date has passed and updates their status to 'Expired'.
 */
const expireOrders = async (): Promise<void> => {
  const now = new Date();
  console.log(`[CronJob: ExpireOrders] Running job at ${now.toISOString()}`);

  try {
    // Find orders that are currently 'Active' and whose 'endDate' is in the past (or exactly now)
    const filter = {
      status: OrderStatus.ACTIVE,
      endDate: { $lte: now }, // $lte means less than or equal to
    };

    // Update matching orders
    const updateResult = await Order.updateMany(
      filter,
      { $set: { status: OrderStatus.EXPIRED } } // Set status to Expired
    );

    if (updateResult.modifiedCount > 0) {
      console.log(
        `[CronJob: ExpireOrders] Successfully expired ${updateResult.modifiedCount} orders.`
      );
    } else {
      console.log(
        `[CronJob: ExpireOrders] No active orders found past their end date.`
      );
    }
  } catch (error) {
    console.error(
      "[CronJob: ExpireOrders] Error occurred while expiring orders:",
      error
    );
  }
};

/**
 * Schedules the expireOrders job to run periodically.
 * Example: Runs once every day at 1:05 AM server time.
 * Cron syntax: second minute hour day-of-month month day-of-week
 * See https://crontab.guru/ for help with syntax.
 */
export const scheduleOrderExpirationJob = (): void => {
  // Schedule to run at 1:05 AM daily
  const schedule = "5 1 * * *"; // 5th minute, 1st hour (1 AM), every day, every month, every day of week

  if (cron.validate(schedule)) {
    console.log(
      `[CronJob: ExpireOrders] Scheduling job with pattern: "${schedule}"`
    );
    cron.schedule(schedule, expireOrders, {
      scheduled: true,
      // Optional: Specify timezone if server time differs from target timezone
      // timezone: "America/Toronto" // Example for Canada/Eastern
    });
  } else {
    console.error(
      `[CronJob: ExpireOrders] Invalid cron schedule pattern: "${schedule}"`
    );
  }

  // Optional: Run once immediately on startup for testing or initial cleanup
  // console.log('[CronJob: ExpireOrders] Running initial check on startup...');
  // expireOrders();
};
