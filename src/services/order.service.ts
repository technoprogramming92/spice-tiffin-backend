// src/services/order.service.ts

import mongoose, { Types } from "mongoose";
import {
  Order,
  IOrder,
  OrderStatus,
  DeliveryStatus,
  IDeliveryAddress,
  IPaymentDetails,
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
  packagePrice: number;
  deliveryDays: number;
  startDate: Date;
  endDate: Date;
  deliverySchedule: Date[];
  status: OrderStatus;
  deliveryStatus: DeliveryStatus; // Added back
  assignedDriver: Types.ObjectId | null;
  deliveryAddress: IDeliveryAddress;
  paymentDetails: IPaymentDetails;
}

export interface IAdminOrderUpdatePayload {
  status?: OrderStatus;
  deliveryStatus?: DeliveryStatus;
  assignedDriver?: Types.ObjectId | string | null;
  // You can add more fields here that an admin is allowed to update
  // For example:
  // notes?: string;
  // 'deliveryAddress.address'?: string; // For updating nested fields
}

interface GetAllOrdersAdminOptions {
  page?: number;
  limit?: number;
  status?: string;
  deliveryStatus?: string; // Allow filtering by deliveryStatus
  search?: string;
  sortBy?: string; // e.g., 'createdAt_desc', 'endDate_asc'
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
      deliveryStatus: DeliveryStatus.SCHEDULED,
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

/**
 * Fetches all orders for a specific customer.
 */
export const getCustomerOrders = async (
  customerId: string | Types.ObjectId
): Promise<IOrder[]> => {
  logger.debug(`[OrderService] Fetching orders for customer ID: ${customerId}`);
  if (!Types.ObjectId.isValid(customerId)) {
    throw new AppError("Invalid customer ID format.", 400);
  }
  return Order.find({ customer: new Types.ObjectId(customerId) })
    .populate("package", "name type image price days") // Select fields you need
    .sort({ createdAt: -1 });
};

/**
 * Fetches a single order by its ID for a specific customer.
 * Ensures the order belongs to the requesting customer.
 */
export const getCustomerOrderById = async (
  orderId: string | Types.ObjectId,
  customerId: string | Types.ObjectId
): Promise<IOrder> => {
  logger.debug(
    `[OrderService] Fetching order ID: ${orderId} for customer ID: ${customerId}`
  );
  if (!Types.ObjectId.isValid(orderId) || !Types.ObjectId.isValid(customerId)) {
    throw new AppError("Invalid order ID or customer ID format.", 400);
  }

  const order = await Order.findOne({
    _id: new Types.ObjectId(orderId),
    customer: new Types.ObjectId(customerId),
  }).populate("package", "name type image price days deliveryDays"); // Add relevant package fields

  if (!order) {
    throw new AppError("Order not found or access denied.", 404);
  }
  return order;
};

/**
 * Fetches all orders for the Admin Panel with pagination and filtering.
 */
export const getAllOrdersAdmin = async (
  options: GetAllOrdersAdminOptions
): Promise<{
  orders: IOrder[];
  totalOrders: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}> => {
  const page = options.page || 1;
  const limit = options.limit || 15;
  const skip = (page - 1) * limit;

  logger.debug(`[OrderService] Admin fetching all orders. Options:`, options);

  const filterQuery: mongoose.FilterQuery<IOrder> = {};

  if (
    options.status &&
    Object.values(OrderStatus).includes(options.status as OrderStatus)
  ) {
    filterQuery.status = options.status as OrderStatus;
  }
  if (
    options.deliveryStatus &&
    Object.values(DeliveryStatus).includes(
      options.deliveryStatus as DeliveryStatus
    )
  ) {
    filterQuery.deliveryStatus = options.deliveryStatus as DeliveryStatus;
  }

  if (options.search) {
    const searchRegex = new RegExp(options.search, "i");
    filterQuery.$or = [
      { orderNumber: { $regex: searchRegex } },
      { packageName: { $regex: searchRegex } },
      // Consider searching populated fields via separate queries or denormalization for performance
      // { 'customer.fullName': { $regex: searchRegex } } // This won't work directly with .find()
    ];
  }

  // Basic sort
  let sortOption: any = { createdAt: -1 };
  if (options.sortBy) {
    const parts = options.sortBy.split("_"); // e.g. "createdAt_desc"
    if (parts.length === 2) {
      sortOption = { [parts[0]]: parts[1] === "desc" ? -1 : 1 };
    }
  }

  const [totalOrders, orders] = await Promise.all([
    Order.countDocuments(filterQuery),
    Order.find(filterQuery)
      .populate("customer", "fullName email mobile")
      .populate("package", "name type")
      .sort(sortOption)
      .skip(skip)
      .limit(limit),
  ]);

  const totalPages = Math.ceil(totalOrders / limit);

  return { orders, totalOrders, totalPages, currentPage: page, limit };
};

/**
 * Fetches a single order by its ID for an admin.
 */
export const getAdminOrderById = async (
  orderId: string | Types.ObjectId
): Promise<IOrder> => {
  logger.debug(`[OrderService] Admin fetching order by ID: ${orderId}`);
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError("Invalid order ID format.", 400);
  }
  const order = await Order.findById(orderId)
    .populate(
      "customer",
      "fullName email mobile verification address city postalCode"
    )
    .populate("package") // Populate full package for admin
    .populate("assignedDriver", "fullName email mobile"); // Populate driver if assigned

  if (!order) {
    throw new AppError("Order not found.", 404);
  }
  return order;
};

/**
 * Updates an order by an admin.
 */
export const updateAdminOrder = async (
  orderId: string | Types.ObjectId,
  updateData: IAdminOrderUpdatePayload
): Promise<IOrder> => {
  logger.debug(
    `[OrderService] Admin updating order ID: ${orderId} with data:`,
    updateData
  );
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError("Invalid order ID format.", 400);
  }

  // Prepare the update payload, especially for unsetting or converting IDs
  const finalUpdatePayload: any = {};
  const setOperations: Partial<IOrder> = {};
  const unsetOperations: any = {};

  for (const key in updateData) {
    const typedKey = key as keyof IAdminOrderUpdatePayload;
    if (
      updateData[typedKey] === null &&
      typedKey === "assignedDriver" /* add other nullable fields here */
    ) {
      unsetOperations[typedKey] = "";
    } else if (typedKey === "assignedDriver" && updateData.assignedDriver) {
      setOperations[typedKey] = new Types.ObjectId(
        updateData.assignedDriver as string
      );
    } else if (updateData[typedKey] !== undefined) {
      (setOperations as any)[typedKey] = updateData[typedKey];
    }
  }

  if (Object.keys(setOperations).length > 0) {
    finalUpdatePayload.$set = setOperations;
  }
  if (Object.keys(unsetOperations).length > 0) {
    finalUpdatePayload.$unset = unsetOperations;
  }

  if (Object.keys(finalUpdatePayload).length === 0) {
    logger.warn(
      `[OrderService] No valid update operations for order ID: ${orderId}. Fetching current order.`
    );
    // If no actual update operations, fetch and return current order or throw error.
    // Let's fetch for consistency, or throw AppError for "no update data provided".
    const currentOrder = await Order.findById(orderId);
    if (!currentOrder) throw new AppError("Order not found for update.", 404);
    return currentOrder;
  }

  const order = await Order.findByIdAndUpdate(orderId, finalUpdatePayload, {
    new: true,
    runValidators: true,
  });

  if (!order) {
    throw new AppError("Order not found, or update failed.", 404); // findByIdAndUpdate returns null if not found
  }
  logger.info(
    `[OrderService] Order ${order.orderNumber} updated successfully by admin.`
  );
  return order;
};

/**
 * Deletes an order by an admin (hard delete).
 */
export const deleteAdminOrder = async (
  orderId: string | Types.ObjectId
): Promise<void> => {
  logger.debug(
    `[OrderService] Admin attempting to delete order ID: ${orderId}`
  );
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError("Invalid order ID format.", 400);
  }

  const result = await Order.findByIdAndDelete(orderId);

  if (!result) {
    throw new AppError("Order not found for deletion.", 404);
  }
  logger.info(
    `[OrderService] Order ${result.orderNumber} deleted successfully by admin.`
  );
  // No explicit return value needed if successful, or return the deleted doc if desired
};
