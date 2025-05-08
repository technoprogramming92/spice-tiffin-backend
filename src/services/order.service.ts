// src/services/order.service.ts (BACKEND)

import mongoose, { Types } from "mongoose";
import { Customer, ICustomer } from "../models/Customer.model.js"; // Adjust path
import { Package, IPackage } from "../models/Package.model.js"; // Adjust path
import {
  Order,
  IOrder, // Use the interface defined WITH explicit _id below
  OrderStatus,
  DeliveryStatus,
  IDeliveryAddress,
  IPaymentDetails,
} from "../models/Order.model.js"; // Adjust path
import { Addon as AddonModel, IAddon } from "../models/addon.model.js"; // Ensure Addon model is exported as 'Addon'
import { geocodeAddress, GeocodeResult } from "../utils/geocode.js"; // Requires this utility file
import { deliveryDateService } from "./delivery-date.service.js"; // Requires this service file
import { stripe } from "../utils/stripe.js"; // Requires this Stripe utility file

// Explicit IOrder definition including _id (helps TS inference)
// Ensure this matches or is compatible with the one in Order.model.ts

// Interface for parameters passed to createOrderFromPayment
interface CreateOrderParams {
  userId: string;
  packageId: string;
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  amountPaid: number; // Amount in smallest currency unit (e.g., cents)
  currency: string;
  paymentMethodDetails?: {
    type?: string;
    card?: { brand?: string; last4?: string };
  };
}

// Helper function to generate order number
function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SBF-${year}${month}${day}-${randomPart}`;
}

/**
 * Creates an Order document after successful Stripe payment.
 * Calculates delivery schedule based on admin settings.
 * Includes geocoding. Uses a transaction.
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
  console.log(
    `[OrderService] Starting order creation for user: ${userId}, package: ${packageId}, PI: ${stripePaymentIntentId}`
  );

  const session = await mongoose.startSession();
  session.startTransaction();
  console.log(`[OrderService] Transaction started.`);

  try {
    // 1. Fetch Customer and Package
    const [customer, selectedPackageDoc] = await Promise.all([
      Customer.findById(userId).session(session),
      Package.findById(packageId).session(session),
    ]);
    if (!customer) {
      throw Object.assign(new Error(`Customer not found: ${userId}`), {
        statusCode: 404,
      });
    }
    if (!selectedPackageDoc) {
      throw Object.assign(new Error(`Package not found: ${packageId}`), {
        statusCode: 404,
      });
    }

    const selectedPackage = selectedPackageDoc.toObject<IPackage>();
    const {
      name: packageName,
      price: packagePrice,
      days: numberOfDeliveries,
    } = selectedPackage;

    if (typeof numberOfDeliveries !== "number" || numberOfDeliveries <= 0) {
      throw Object.assign(
        new Error(`Invalid deliveries: ${numberOfDeliveries}`),
        { statusCode: 400 }
      );
    }
    if (typeof packagePrice !== "number" || typeof packageName !== "string") {
      throw Object.assign(new Error(`Invalid package data`), {
        statusCode: 400,
      });
    }
    console.log(
      `[OrderService] Customer ${customer.fullName} & Package ${packageName} found.`
    );

    // 2. Verify Payment Amount
    const expectedAmountCents = Math.round(packagePrice * 100);
    console.log(
      `[OrderService] Verifying amount. Expected: ${expectedAmountCents}, Paid: ${amountPaid}`
    );
    if (amountPaid !== expectedAmountCents) {
      throw Object.assign(new Error(`Payment amount mismatch`), {
        statusCode: 400,
      });
    }

    // 3. Check for existing order (Idempotency)
    console.log(
      `[OrderService] Checking for existing order with PI ID: ${stripePaymentIntentId}...`
    );
    const existingOrder = await Order.findOne({
      "paymentDetails.stripePaymentIntentId": stripePaymentIntentId,
    }).session(session);
    if (existingOrder) {
      console.warn(
        `[OrderService] Order ${existingOrder.orderNumber} already exists. Aborting.`
      );
      await session.abortTransaction();
      session.endSession();
      return existingOrder;
    }
    console.log(`[OrderService] No existing order found.`);

    // 4. Prepare Address (with Geocoding)
    const deliveryAddress: IDeliveryAddress = {
      address: customer.address,
      city: customer.city,
      postalCode: customer.postalCode,
      currentLocation: customer.currentLocation,
      latitude: undefined,
      longitude: undefined,
    };
    try {
      console.log(`[OrderService] Geocoding delivery address...`);
      // Assumes geocodeAddress utility exists and is imported
      const coordinates: GeocodeResult | null =
        await geocodeAddress(deliveryAddress);
      if (coordinates) {
        deliveryAddress.latitude = coordinates.latitude;
        deliveryAddress.longitude = coordinates.longitude;
        console.log(`[OrderService] Geocoding successful.`);
      } else {
        console.warn(
          `[OrderService] Geocoding failed. Order created without coordinates.`
        );
      }
    } catch (geoError) {
      console.error(`[OrderService] Geocoding error:`, geoError);
      // Continue without coordinates
    }

    // 5. Prepare Payment Details Sub-document
    const paymentDetails: IPaymentDetails = {
      stripePaymentIntentId: stripePaymentIntentId,
      stripeCustomerId: stripeCustomerId,
      amountPaid: amountPaid,
      currency: currency.toLowerCase(),
      paymentMethodType: paymentMethodDetails?.type,
      cardBrand: paymentMethodDetails?.card?.brand,
      cardLast4: paymentMethodDetails?.card?.last4,
      paymentDate: new Date(),
    };

    // 6. Calculate Delivery Schedule
    console.log(
      `[OrderService] Calculating ${numberOfDeliveries} delivery dates...`
    );
    const orderStartDate = new Date(); // Actual order placement date
    const firstPossibleDeliveryDay = new Date(orderStartDate);
    firstPossibleDeliveryDay.setUTCDate(
      firstPossibleDeliveryDay.getUTCDate() + 1
    );
    firstPossibleDeliveryDay.setUTCHours(0, 0, 0, 0);

    // Assumes deliveryDateService exists and is imported
    const calculatedDeliveryDates = await deliveryDateService.getAvailableDates(
      firstPossibleDeliveryDay,
      numberOfDeliveries
    );
    if (calculatedDeliveryDates.length < numberOfDeliveries) {
      throw Object.assign(
        new Error(`Unable to schedule all ${numberOfDeliveries} deliveries.`),
        { statusCode: 400 }
      );
    }
    const calculatedEndDate =
      calculatedDeliveryDates[calculatedDeliveryDates.length - 1];
    console.log(
      `[OrderService] Calculated End Date:`,
      calculatedEndDate.toISOString()
    );

    // 7. Prepare Full Order Data
    const orderNumber = generateOrderNumber();
    const newOrderData: Partial<IOrder> = {
      // Use Partial<IOrder> for safety
      orderNumber,
      customer: customer._id,
      package: selectedPackageDoc.id,
      packageName,
      packagePrice,
      deliveryDays: numberOfDeliveries,
      startDate: orderStartDate,
      endDate: calculatedEndDate,
      status: OrderStatus.ACTIVE,
      deliverySchedule: calculatedDeliveryDates,
      deliveryAddress,
      paymentDetails,
      deliveryStatus: DeliveryStatus.SCHEDULED, // Default after schedule calculation
      // assignedDriver: null, // Defaulted by schema
      // deliverySequence: null, // Defaulted by schema
      // proofOfDeliveryUrl: undefined, // Defaulted by schema
    };

    // 8. Create the Order document
    console.log(`[OrderService] Attempting to create order in database...`);
    const createdOrders = await Order.create([newOrderData], { session });
    if (!createdOrders || createdOrders.length === 0) {
      throw new Error("Database failed to create order document.");
    }
    const newOrder = createdOrders[0];
    console.log(`[OrderService] Order document created: ${newOrder.id}`);

    // 9. Commit transaction
    await session.commitTransaction();
    console.log(`[OrderService] Transaction committed successfully.`);
    session.endSession();
    return newOrder;
  } catch (error) {
    console.error(
      "[OrderService] Error during order creation, aborting transaction:",
      error
    );
    if (session.inTransaction()) {
      await session.abortTransaction();
      console.log(`[OrderService] Transaction aborted due to error.`);
    }
    // Ensure session is always ended, even if abort fails
    await session
      .endSession()
      .catch((sessErr) => console.error("Error ending session:", sessErr));

    // Ensure we always throw an Error object with a status code if possible
    let processedError: Error;
    if (error instanceof Error) {
      processedError = error;
      (processedError as any).statusCode = (error as any).statusCode || 500; // Add default status if missing
    } else {
      processedError = new Error("Unknown error during order creation.");
      (processedError as any).statusCode = 500;
    }
    throw processedError; // Re-throw the processed error
  }
};

/**
 * Fetches a single order by ID for Admin view, populating related data.
 * Uses .lean() for performance.
 */
export const getAdminOrderById = async (
  orderId: string
): Promise<IOrder | null> => {
  console.log(`[OrderService] Admin fetching order by ID: ${orderId}`);
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    const error = new Error("Invalid Order ID format.");
    (error as any).statusCode = 400;
    throw error;
  }

  const order = await Order.findById(orderId)
    .populate("customer", "fullName email mobile verification") // Specify desired fields
    .populate("package", "name type days price") // Specify desired fields
    .populate("assignedDriver", "fullName phone status") // Specify desired fields
    .lean(); // Return plain JS object

  if (!order) {
    const error = new Error("Order not found.");
    (error as any).statusCode = 404;
    throw error;
  }
  console.log(`[OrderService] Admin: Found order ${order.orderNumber}`);
  // Cast is okay here if IOrder structure matches lean output, which it should if defined correctly
  return order as IOrder;
};

/**
 * Updates an order by ID for Admin. Only specific fields are allowed.
 */
export const updateAdminOrder = async (
  orderId: string,
  updateData: Partial<IOrder>
): Promise<IOrder | null> => {
  console.log(`[OrderService] Admin updating order ID: ${orderId}`);
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    const error = new Error("Invalid Order ID format.");
    (error as any).statusCode = 400;
    throw error;
  }

  const order = await Order.findById(orderId); // Fetch full Mongoose Document
  if (!order) {
    const error = new Error("Order not found for update.");
    (error as any).statusCode = 404;
    throw error;
  }

  // Define fields admins ARE allowed to update
  // Using a Set for efficient checking
  const allowedUpdateKeys = new Set<string>([
    "status",
    "deliveryStatus",
    "assignedDriver",
    "deliverySequence",
    "proofOfDeliveryUrl",
    "deliveryAddress",
    "startDate",
    "endDate",
    "packageName",
    "packagePrice",
    "deliveryDays",
    "deliverySchedule",
  ]);

  let changesMade = false;

  // --- MODIFIED: Iterate over keys in updateData ---
  for (const key in updateData) {
    // Ensure it's an own property and it's in our allowed list
    if (
      Object.prototype.hasOwnProperty.call(updateData, key) &&
      allowedUpdateKeys.has(key)
    ) {
      const typedKey = key as keyof IOrder; // We know key is allowed now
      const newValue = updateData[typedKey];

      // Use Mongoose .get() for reliable comparison of current value
      const currentValue = order.get(typedKey);

      // --- Handle specific types / nested objects before generic .set ---

      // Nested deliveryAddress update
      if (
        typedKey === "deliveryAddress" &&
        newValue &&
        typeof newValue === "object"
      ) {
        let addressChanged = false;
        const currentAddr = order.deliveryAddress; // Direct access okay here
        const newAddr = newValue as IDeliveryAddress;
        for (const addrKeyStr in newAddr) {
          const addrKey = addrKeyStr as keyof IDeliveryAddress;
          if (
            Object.prototype.hasOwnProperty.call(currentAddr, addrKey) &&
            Object.prototype.hasOwnProperty.call(newAddr, addrKey) && // Ensure newAddr also has the key
            currentAddr[addrKey] !== newAddr[addrKey]
          ) {
            order.set(`deliveryAddress.${addrKey}`, newAddr[addrKey]);
            addressChanged = true;
          }
        }
        if (addressChanged) changesMade = true;
      }
      // Assigned Driver update (ObjectId or null)
      else if (typedKey === "assignedDriver") {
        let driverIdToSet: Types.ObjectId | null = null;
        if (newValue === null || newValue === "") {
          driverIdToSet = null;
        } else if (
          typeof newValue === "string" &&
          mongoose.Types.ObjectId.isValid(newValue)
        ) {
          driverIdToSet = new Types.ObjectId(newValue);
        } else if (
          typeof newValue === "object" &&
          newValue?._id &&
          mongoose.Types.ObjectId.isValid(newValue._id)
        ) {
          driverIdToSet = new Types.ObjectId(newValue._id);
        } else if (newValue !== undefined) {
          console.warn(`Ignoring invalid assignedDriver value:`, newValue);
          continue;
        } // Skip invalid

        // Only set if different (compare as strings/null)
        if (String(order.assignedDriver) !== String(driverIdToSet)) {
          // Use direct assignment for refs sometimes works better with TS
          order.assignedDriver = driverIdToSet;
          changesMade = true;
        }
      }
      // --- FIX: Use Mongoose .set() for other allowed fields ---
      // Compare first to ensure a change occurred before setting
      else if (currentValue !== newValue) {
        order.set(typedKey, newValue); // Use Mongoose .set()
        changesMade = true;
      }
    } else if (Object.prototype.hasOwnProperty.call(updateData, key)) {
      // Log if a key was provided in updateData but isn't in allowedUpdateKeys
      console.warn(
        `[OrderService] Update blocked for non-allowed field: ${key}`
      );
    }
  }
  // --- End of Loop ---

  if (!changesMade) {
    console.log(
      `[OrderService] Admin Update: No valid changes applied for order ${orderId}.`
    );
    return getAdminOrderById(orderId); // Re-fetch populated lean version
  }

  console.log(
    `[OrderService] Admin Update: Saving detected changes for order ${orderId}.`
  );
  try {
    await order.save(); // Run validators and save only modified paths
    console.log(
      `[OrderService] Admin Update: Order ${orderId} saved successfully.`
    );
    return getAdminOrderById(orderId); // Re-fetch populated lean version
  } catch (validationError: any) {
    console.error(
      `[OrderService] Admin Update: Mongoose validation failed:`,
      validationError
    );
    const error = new Error(`Update failed: ${validationError.message}`);
    (error as any).statusCode = 400;
    throw error;
  }
};

/**
 * Deletes an order by ID (Admin action).
 */
export const deleteAdminOrder = async (orderId: string): Promise<boolean> => {
  console.log(`[OrderService] Admin deleting order ID: ${orderId}`);
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    const error = new Error("Invalid Order ID format.");
    (error as any).statusCode = 400;
    throw error;
  }

  try {
    const result = await Order.findByIdAndDelete(orderId);
    if (!result) {
      const error = new Error("Order not found for deletion.");
      (error as any).statusCode = 404;
      throw error;
    }
    console.log(
      `[OrderService] Admin Delete: Successfully deleted order ${orderId}.`
    );
    // !! IMPORTANT: Consider side effects (Stripe, AddonOrders, Notifications etc.) !!
    return true; // Indicate successful deletion
  } catch (error) {
    console.error(
      `[OrderService] Admin Delete: Error deleting order ${orderId}:`,
      error
    );
    if (error instanceof Error && !(error as any).statusCode) {
      (error as any).statusCode = 500;
    }
    throw error; // Re-throw unexpected DB errors
  }
};
