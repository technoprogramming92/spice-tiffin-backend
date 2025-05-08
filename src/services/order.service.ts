// src/services/order.service.ts (BACKEND)

import mongoose, { Types } from "mongoose"; // Import Types
import { Customer, ICustomer } from "../models/Customer.model.js"; // Adjust path
import { Package, IPackage } from "../models/Package.model.js"; // Adjust path
import {
  Order,
  IOrder, // Main Order Interface from model
  OrderStatus,
  DeliveryStatus,
  IDeliveryAddress,
  IPaymentDetails,
} from "../models/Order.model.js"; // Adjust path
import { geocodeAddress, GeocodeResult } from "../utils/geocode.js"; // Import geocode utility
import { deliveryDateService } from "./delivery-date.service.js"; // Import for scheduling

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
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase(); // Slightly shorter random part
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
    `[OrderService] Starting order creation for user: ${userId}, package: ${packageId}, paymentIntent: ${stripePaymentIntentId}`
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
    if (!customer) throw new Error(`Customer not found for ID: ${userId}`);
    if (!selectedPackageDoc)
      throw new Error(`Package not found for ID: ${packageId}`);
    const selectedPackage = selectedPackageDoc.toObject<IPackage>();
    const {
      name: packageName,
      price: packagePrice,
      days: numberOfDeliveries,
    } = selectedPackage; // Assuming 'days' = number of deliveries

    if (typeof numberOfDeliveries !== "number" || numberOfDeliveries <= 0) {
      throw new Error(
        `Invalid number of deliveries (${numberOfDeliveries}) found for package ${packageId}.`
      );
    }
    if (typeof packagePrice !== "number" || typeof packageName !== "string") {
      throw new Error(`Invalid data type found for package ${packageId}.`);
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
      throw new Error(
        `Payment amount mismatch. Expected ${expectedAmountCents}, received ${amountPaid}`
      );
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

    // 4. Prepare Address (with Geocoding)
    const deliveryAddress: IDeliveryAddress = {
      address: customer.address,
      city: customer.city,
      postalCode: customer.postalCode,
      currentLocation: customer.currentLocation,
    };
    try {
      console.log(`[OrderService] Geocoding delivery address...`);
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
      console.error(`[OrderService] Geocoding threw error:`, geoError);
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
    ); // Start checking from tomorrow UTC
    firstPossibleDeliveryDay.setUTCHours(0, 0, 0, 0);

    const calculatedDeliveryDates = await deliveryDateService.getAvailableDates(
      firstPossibleDeliveryDay,
      numberOfDeliveries
    );
    if (calculatedDeliveryDates.length < numberOfDeliveries) {
      throw new Error(
        `Unable to schedule all ${numberOfDeliveries} deliveries based on current availability.`
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
    const newOrderData = {
      orderNumber,
      customer: customer._id,
      package: selectedPackageDoc._id,
      packageName,
      packagePrice,
      deliveryDays: numberOfDeliveries, // Store intended number of deliveries
      startDate: orderStartDate, // Date order was placed
      endDate: calculatedEndDate, // Date of last scheduled delivery
      status: OrderStatus.ACTIVE, // Start as Active
      deliverySchedule: calculatedDeliveryDates, // Store the schedule
      deliveryAddress,
      paymentDetails,
      deliveryStatus: DeliveryStatus.SCHEDULED, // Start as Scheduled since dates are set
    };

    // 8. Create the Order document
    console.log(`[OrderService] Attempting to create order in database...`);
    const createdOrders = await Order.create([newOrderData], { session });
    if (!createdOrders || createdOrders.length === 0) {
      throw new Error("Database failed to create order document.");
    }
    const newOrder = createdOrders[0];
    console.log(`[OrderService] Order document created: ${newOrder.id}`); // Use .id here

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
    }
    session.endSession();
    // Re-throw classified error
    if (error instanceof Error) {
      if (!(error as any).statusCode) {
        (error as any).statusCode = 500;
      }
      throw error;
    } else {
      const unknownError = new Error("Unknown error during order creation.");
      (unknownError as any).statusCode = 500;
      throw unknownError;
    }
  }
};

/**
 * Fetches a single order by ID for Admin view, populating related data.
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
    .populate("customer", "fullName email mobile verification")
    .populate("package", "name type days price")
    .populate("assignedDriver", "fullName phone status")
    .lean(); // Using lean() here for performance, return type is now plain object

  if (!order) {
    const error = new Error("Order not found.");
    (error as any).statusCode = 404;
    throw error;
  }
  console.log(`[OrderService] Admin: Found order ${order.orderNumber}`);
  // Note: Since we use .lean(), the return type is technically not IOrder (Mongoose Document)
  // but a plain object matching its structure. Define a specific lean type if needed,
  // or cast carefully in the controller/adjust frontend type.
  // For simplicity, we'll rely on structural compatibility.
  return order as IOrder; // Cast for now, ensure IOrder matches lean structure
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

  // Fetch the actual Mongoose document for update
  const order = await Order.findById(orderId);
  if (!order) {
    const error = new Error("Order not found for update.");
    (error as any).statusCode = 404;
    throw error;
  }

  const allowedUpdates: Array<
    keyof Omit<
      IOrder,
      | "_id"
      | "createdAt"
      | "updatedAt"
      | "customer"
      | "package"
      | "paymentDetails"
      | "orderNumber"
    >
  > = [
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
    "deliverySchedule", // Allow editing schedule? Risky without recalculation. Let's keep it for now but comment out direct update.
  ];

  let changesMade = false;
  for (const key of allowedUpdates) {
    const typedKey = key as keyof IOrder; // Use the key directly

    // Skip if updateData doesn't provide this key
    if (!Object.prototype.hasOwnProperty.call(updateData, typedKey)) continue;

    const newValue = updateData[typedKey];

    // Handle nested deliveryAddress update
    if (
      typedKey === "deliveryAddress" &&
      newValue &&
      typeof newValue === "object"
    ) {
      let addressChanged = false;
      const currentAddr = order.deliveryAddress;
      const newAddr = newValue as IDeliveryAddress; // Assume structure matches
      for (const addrKey in newAddr) {
        if (
          Object.prototype.hasOwnProperty.call(currentAddr, addrKey) &&
          currentAddr[addrKey as keyof IDeliveryAddress] !==
            newAddr[addrKey as keyof IDeliveryAddress]
        ) {
          currentAddr[addrKey as keyof IDeliveryAddress] =
            newAddr[addrKey as keyof IDeliveryAddress];
          addressChanged = true;
        }
      }
      if (addressChanged) {
        order.markModified("deliveryAddress");
        changesMade = true;
      }
    }
    // Handle assignedDriver update (ObjectId or null)
    else if (typedKey === "assignedDriver") {
      let driverIdToSet: Types.ObjectId | null = null;
      if (newValue === null) {
        driverIdToSet = null;
      } else if (
        typeof newValue === "string" &&
        mongoose.Types.ObjectId.isValid(newValue)
      ) {
        driverIdToSet = new mongoose.Types.ObjectId(newValue);
      } else if (
        typeof newValue === "object" &&
        newValue?._id &&
        mongoose.Types.ObjectId.isValid(newValue._id)
      ) {
        driverIdToSet = new mongoose.Types.ObjectId(newValue._id);
      } else if (newValue !== undefined) {
        console.warn(
          `[OrderService] Ignoring invalid assignedDriver value:`,
          newValue
        );
      }
      // Check if value actually changed
      if (String(order.assignedDriver) !== String(driverIdToSet)) {
        // Compare string/null representations
        order.assignedDriver = driverIdToSet;
        changesMade = true;
      }
    }
    // --- Handle deliverySchedule Update (Example - needs validation) ---
    // else if (typedKey === 'deliverySchedule' && Array.isArray(newValue)) {
    //      // WARNING: Requires extensive validation to ensure dates are valid,
    //      // ordered, match deliveryDays count, within endDate etc.
    //      // Simple assignment shown, but proper logic is needed.
    //      if (JSON.stringify(order.deliverySchedule) !== JSON.stringify(newValue)) {
    //          order.deliverySchedule = newValue.map(d => new Date(d)); // Ensure they are Date objects
    //          order.markModified('deliverySchedule');
    //          changesMade = true;
    //      }
    // }
    // --- End deliverySchedule ---
    // Handle other direct fields
    else if (typedKey !== "deliveryAddress" && order[typedKey] !== newValue) {
      // Ensure dates are handled correctly if sent as strings
      if (
        (typedKey === "startDate" || typedKey === "endDate") &&
        typeof newValue === "string"
      ) {
        const newDate = new Date(newValue);
        if (
          !isNaN(newDate.getTime()) &&
          order[typedKey]?.getTime() !== newDate.getTime()
        ) {
          order[typedKey] = newDate;
          changesMade = true;
        }
      } else if (typedKey !== "startDate" && typedKey !== "endDate") {
        // Direct assignment for status, deliveryStatus, package details etc.
        // Type checking might be needed for number fields like deliveryDays/packagePrice
        if (
          typedKey === "packagePrice" ||
          typedKey === "deliveryDays" ||
          typedKey === "deliverySequence"
        ) {
          if (typeof newValue === "number" && order[typedKey] !== newValue) {
            order[typedKey] = newValue;
            changesMade = true;
          }
        } else {
          order[typedKey] = newValue;
          changesMade = true;
        }
      }
    }
  }

  if (!changesMade) {
    console.log(
      `[OrderService] Admin Update: No valid changes detected for order ${orderId}.`
    );
    // Fetch again to return consistent populated data
    return getAdminOrderById(orderId);
  }

  console.log(
    `[OrderService] Admin Update: Saving changes for order ${orderId}.`
  );
  try {
    await order.save(); // Run validators on save
    console.log(
      `[OrderService] Admin Update: Order ${orderId} saved successfully.`
    );
    // Re-fetch with population after saving
    return getAdminOrderById(orderId); // Use the function defined above
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
    // !! IMPORTANT: Consider side effects (Stripe, AddonOrders, Notifications) !!
    return true;
  } catch (error) {
    console.error(
      `[OrderService] Admin Delete: Error deleting order ${orderId}:`,
      error
    );
    if (error instanceof Error && !(error as any).statusCode) {
      (error as any).statusCode = 500;
    }
    throw error;
  }
};
