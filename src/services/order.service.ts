// src/services/order.service.ts

import mongoose, { Types } from "mongoose";
import {
  Order,
  OrderStatus,
  IDeliveryAddress,
  IPaymentDetails,
  IOrder,
} from "../models/Order.model.js";
import { Customer } from "../models/Customer.model.js";
import { Package, IPackage } from "../models/Package.model.js";
import { DeliveryDateService } from "./delivery-date.service.js"; // Import the new service
import { AppError } from "../utils/AppError.js";
import logger from "../config/logger.js";
// Assume geocodeAddress utility exists and returns { latitude: number, longitude: number } | null
import { geocodeAddress, GeocodeResult } from "../utils/geocode.js"; // Adjust path
// Assume generateOrderNumber utility exists
import { generateOrderNumber } from "../utils/orderHelper.js"; // Adjust path

// Interface for parameters coming into the service
interface CreateOrderParams {
  userId: string | Types.ObjectId;
  packageId: string | Types.ObjectId;
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  amountPaid: number; // In cents
  currency: string;
  paymentMethodDetails?: {
    type?: string;
    card?: {
      brand?: string;
      last4?: string;
    };
  };
}

interface NewOrderData {
  orderNumber: string;
  customer: Types.ObjectId;
  package: Types.ObjectId;
  packageName: string;
  packagePrice: number; // Price in cents
  deliveryDays: number;
  startDate: Date;
  endDate: Date;
  deliverySchedule: Date[];
  status: OrderStatus;
  assignedDriver: Types.ObjectId | null;
  deliveryAddress: IDeliveryAddress;
  paymentDetails: IPaymentDetails;
}

/**
 * Creates an Order after successful payment, calculating the delivery schedule.
 */
export const createOrderFromPayment = async (
  params: CreateOrderParams
): Promise<IOrder> => {
  const {
    userId,
    packageId,
    stripePaymentIntentId,
    stripeCustomerId,
    amountPaid,
    currency,
    paymentMethodDetails,
  } = params;
  logger.info(
    `[OrderService] Starting order creation. User: ${userId}, Package: ${packageId}, PI: ${stripePaymentIntentId}`
  );

  const session = await mongoose.startSession();
  session.startTransaction();
  logger.debug(`[OrderService] Transaction started.`);

  try {
    // 1. Fetch Customer and Package (within transaction)
    const [customerDoc, selectedPackageDoc] = await Promise.all([
      Customer.findById(userId).session(session),
      Package.findById(packageId).session(session),
    ]);
    if (!customerDoc) {
      throw new AppError(`Customer not found: ${userId}`, 404);
    }
    if (!selectedPackageDoc) {
      throw new AppError(`Package not found: ${packageId}`, 404);
    }
    const customer = customerDoc.toObject(); // Use plain object if needed later
    const selectedPackage = selectedPackageDoc.toObject<IPackage>();
    const {
      name: packageName,
      price: packagePrice, // Assuming this is in base currency units (e.g., dollars)
      days: numberOfDeliveries, // This is the count of deliveries
    } = selectedPackage;

    if (typeof numberOfDeliveries !== "number" || numberOfDeliveries <= 0) {
      throw new AppError(
        `Invalid number of deliveries in package: ${numberOfDeliveries}`,
        400
      );
    }
    if (typeof packagePrice !== "number" || typeof packageName !== "string") {
      throw new AppError(`Invalid package data retrieved`, 500); // Should not happen if DB is consistent
    }
    logger.debug(
      `[OrderService] Customer ${customer.fullName} & Package ${packageName} (Deliveries: ${numberOfDeliveries}) found.`
    );

    // 2. Verify Payment Amount (convert package price to cents)
    const expectedAmountCents = Math.round(packagePrice * 100);
    logger.debug(
      `[OrderService] Verifying amount. Expected: ${expectedAmountCents}, Paid: ${amountPaid}`
    );
    if (amountPaid !== expectedAmountCents) {
      // Consider a tolerance? For now, exact match.
      throw new AppError(
        `Payment amount mismatch. Expected ${expectedAmountCents}, paid ${amountPaid}`,
        400
      );
    }

    // 3. Check for existing order (Idempotency)
    logger.debug(
      `[OrderService] Checking for existing order with PI ID: ${stripePaymentIntentId}`
    );
    const existingOrder = await Order.findOne({
      "paymentDetails.stripePaymentIntentId": stripePaymentIntentId,
    }).session(session);

    if (existingOrder) {
      logger.warn(
        `[OrderService] Order ${existingOrder.orderNumber} already exists for PI ${stripePaymentIntentId}. Aborting creation and returning existing order.`
      );
      // IMPORTANT: Decide if aborting transaction here is right.
      // If the webhook might retry, aborting prevents further action.
      // If this function is called directly after payment success UI, returning existing is fine.
      // Let's abort for safety in webhook context.
      await session.abortTransaction();
      logger.debug(
        `[OrderService] Transaction aborted because order already exists.`
      );
      session.endSession();
      return existingOrder;
    }
    logger.debug(
      `[OrderService] No existing order found for this payment intent.`
    );

    // 4. Prepare Address (with Geocoding)
    const deliveryAddress: IDeliveryAddress = {
      // This object is what your geocodeAddress function expects
      address: customer.address,
      city: customer.city,
      postalCode: customer.postalCode,
      currentLocation: customer.currentLocation, // Make sure this is intended to be part of geocoding search string if used by geocode.ts
      latitude: undefined,
      longitude: undefined,
    };
    try {
      const logAddressString =
        `${deliveryAddress.address || ""}, ${deliveryAddress.city || ""}, ${deliveryAddress.postalCode || ""}`
          .trim()
          .replace(/^,|,$/g, "");
      logger.debug(
        `[OrderService] Attempting to geocode delivery address object for: ${logAddressString}`
      );
      const fullAddress =
        `${deliveryAddress.address || ""}, ${deliveryAddress.city || ""}, ${deliveryAddress.postalCode || ""}`
          .trim()
          .replace(/^,|,$/g, "");
      const coordinates: GeocodeResult | null =
        await geocodeAddress(deliveryAddress);

      if (coordinates) {
        deliveryAddress.latitude = coordinates.latitude;
        deliveryAddress.longitude = coordinates.longitude;
        logger.debug(
          `[OrderService] Geocoding successful: Lat ${coordinates.latitude}, Lon ${coordinates.longitude}`
        );
      } else {
        logger.warn(
          `[OrderService] Geocoding failed or returned no results. Order will be created without coordinates.`
        );
      }
    } catch (geoError) {
      logger.error(`[OrderService] Geocoding process error:`, geoError);
      // Decide if this is fatal. For now, continue without coordinates.
    }

    // 5. Prepare Payment Details Sub-document
    const paymentDetails: IPaymentDetails = {
      stripePaymentIntentId: stripePaymentIntentId,
      stripeCustomerId: stripeCustomerId,
      amountPaid: amountPaid, // Already in cents
      currency: currency.toLowerCase(),
      paymentMethodType: paymentMethodDetails?.type,
      cardBrand: paymentMethodDetails?.card?.brand,
      cardLast4: paymentMethodDetails?.card?.last4,
      paymentDate: new Date(), // Capture payment time
    };

    // 6. Calculate Delivery Schedule using DeliveryDateService
    logger.debug(
      `[OrderService] Calculating ${numberOfDeliveries} delivery dates using DeliveryDateService...`
    );
    // Determine the first day to check = tomorrow (UTC midnight)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    const calculatedDeliveryDates = await DeliveryDateService.getAvailableDates(
      tomorrow,
      numberOfDeliveries
      // Optionally pass maxSearchDays if needed: , 120
    );
    // getAvailableDates throws error if not enough dates found, so no need to check length here again.

    const calculatedStartDate = calculatedDeliveryDates[0]; // First delivery date
    const calculatedEndDate =
      calculatedDeliveryDates[calculatedDeliveryDates.length - 1]; // Last delivery date
    logger.debug(
      `[OrderService] Delivery Schedule Calculated. Start: ${calculatedStartDate.toISOString()}, End: ${calculatedEndDate.toISOString()}`
    );

    // 7. Prepare Full Order Data for the new model structure
    const orderNumber = generateOrderNumber();
    const newOrderData: NewOrderData = {
      orderNumber,
      customer: new Types.ObjectId(userId),
      package: new Types.ObjectId(packageId),
      packageName,
      packagePrice: expectedAmountCents, // Use the verified amount in cents
      deliveryDays: numberOfDeliveries,
      startDate: calculatedStartDate,
      endDate: calculatedEndDate,
      deliverySchedule: calculatedDeliveryDates,
      status: OrderStatus.ACTIVE,
      assignedDriver: null, // Defaulted
      deliveryAddress,
      paymentDetails,
    };

    // 8. Create the Order document
    logger.debug(
      `[OrderService] Attempting to create order document in database...`
    );
    // Use create() which returns an array
    const createdOrders = await Order.create([newOrderData], { session });
    if (!createdOrders || createdOrders.length === 0) {
      // This case should ideally be caught by Mongoose validation or DB errors handled below
      throw new Error("Database failed to return created order document.");
    }
    const newOrder = createdOrders[0];
    logger.info(
      `[OrderService] Order document created successfully: ${newOrder.orderNumber} (ID: ${newOrder._id})`
    );

    // 9. Commit transaction
    await session.commitTransaction();
    logger.info(
      `[OrderService] Transaction committed successfully for Order ${newOrder.orderNumber}.`
    );
    session.endSession();
    return newOrder;
  } catch (error) {
    logger.error(
      "[OrderService] Error during order creation, aborting transaction:",
      error
    );
    if (session.inTransaction()) {
      await session.abortTransaction();
      logger.debug(`[OrderService] Transaction aborted due to error.`);
    }
    await session
      .endSession()
      .catch((sessErr) =>
        logger.error("Error ending session after abort:", sessErr)
      );

    // Ensure a consistent error type is thrown
    if (error instanceof AppError) {
      throw error; // Re-throw known AppErrors
    } else if (error instanceof Error) {
      // Wrap other errors
      throw new AppError(
        `Order creation failed: ${error.message}`,
        (error as any).statusCode || 500
      );
    } else {
      // Handle non-Error types
      throw new AppError(
        "An unknown error occurred during order creation.",
        500
      );
    }
  }
};
