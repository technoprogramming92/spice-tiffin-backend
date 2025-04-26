// services/order.service.ts
import { Customer, ICustomer } from "../models/Customer.model.js";
import { Package, IPackage } from "../models/Package.model.js";
import {
  Order,
  IOrder,
  OrderStatus,
  IDeliveryAddress,
  IPaymentDetails,
} from "../models/Order.model.js"; // Import updated types
import mongoose from "mongoose";

interface CreateOrderParams {
  userId: string;
  packageId: string;
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  amountPaid: number; // Amount in smallest currency unit (e.g., cents)
  currency: string; // e.g., 'cad'
  paymentMethodDetails?: {
    type?: string;
    card?: {
      brand?: string;
      last4?: string;
    };
  };
}

// --- NEW: Helper function to generate order number ---
// (Can be moved to a utils file if preferred)
function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, "0"); // 01-12
  const day = now.getDate().toString().padStart(2, "0"); // 01-31
  // Increased randomness slightly
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `SBF-${year}${month}${day}-${randomPart}`;
}
// --- End Helper Function ---

/**
 * Creates an Order document in the database after a successful Stripe payment.
 * @param params - Details extracted from the Stripe payment event.
 * @returns The newly created Order document.
 * @throws Error with a statusCode property if validation fails or database operation fails.
 */
export const createOrderFromPayment = async (
  params: CreateOrderParams
): Promise<IOrder> => {
  const {
    userId,
    packageId,
    stripePaymentIntentId,
    stripeCustomerId,
    amountPaid, // in cents
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
    console.log(`[OrderService] Fetching customer ${userId}...`);
    const customer = await Customer.findById(userId).session(session);
    if (!customer) {
      /* ... error handling ... */ throw new Error(
        `Customer not found for ID: ${userId}`
      );
    }
    console.log(`[OrderService] Customer found: ${customer.fullName}`);

    console.log(`[OrderService] Fetching package ${packageId}...`);
    const selectedPackageDoc =
      await Package.findById(packageId).session(session);
    if (!selectedPackageDoc) {
      /* ... error handling ... */ throw new Error(
        `Package not found for ID: ${packageId}`
      );
    }
    const selectedPackage = selectedPackageDoc.toObject<IPackage>();
    console.log(`[OrderService] Package found: ${selectedPackage.name}`);

    const {
      days: deliveryDays,
      price: packagePrice,
      name: packageName,
    } = selectedPackage;
    if (
      typeof deliveryDays !== "number" ||
      typeof packagePrice !== "number" ||
      typeof packageName !== "string"
    ) {
      /* ... error handling ... */ throw new Error(
        `Invalid data type found for package ${packageId}.`
      );
    }

    // 2. Verify Payment Amount
    const expectedAmountCents = Math.round(packagePrice * 100);
    console.log(
      `[OrderService] Verifying amount. Expected (cents): ${expectedAmountCents}, Paid (cents): ${amountPaid}`
    );
    if (amountPaid !== expectedAmountCents) {
      /* ... error handling ... */ throw new Error(
        `Payment amount mismatch. Expected ${expectedAmountCents}, received ${amountPaid}`
      );
    }
    console.log(`[OrderService] Amount verified.`);

    // 3. Check for existing order (Idempotency)
    console.log(
      `[OrderService] Checking for existing order with paymentIntent ID: ${stripePaymentIntentId}...`
    );
    const existingOrder = await Order.findOne({
      "paymentDetails.stripePaymentIntentId": stripePaymentIntentId,
    }).session(session);
    if (existingOrder) {
      console.warn(
        `[OrderService] Order ${existingOrder.orderNumber} already exists for payment intent ID. Aborting transaction.`
      );
      await session.abortTransaction();
      session.endSession();
      console.log(`[OrderService] Transaction aborted (duplicate).`);
      return existingOrder;
    }
    console.log(`[OrderService] No existing order found.`);

    // 4. Prepare Order Data
    console.log(`[OrderService] Preparing new order data...`);
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + deliveryDays * 24 * 60 * 60 * 1000
    );
    const deliveryAddress: IDeliveryAddress = {
      address: customer.address,
      city: customer.city,
      postalCode: customer.postalCode,
      currentLocation: customer.currentLocation,
    };
    const paymentDetails: IPaymentDetails = {
      // Explicitly type here
      stripePaymentIntentId: stripePaymentIntentId,
      stripeCustomerId: stripeCustomerId,
      amountPaid: amountPaid,
      currency: currency.toLowerCase(),
      paymentMethodType: paymentMethodDetails?.type,
      cardBrand: paymentMethodDetails?.card?.brand,
      cardLast4: paymentMethodDetails?.card?.last4,
      paymentDate: new Date(),
    };

    // --- GENERATE ORDER NUMBER BEFORE CREATE ---
    const orderNumber = generateOrderNumber();
    console.log(`[OrderService] Generated Order Number: ${orderNumber}`);
    // -----------------------------------------

    const newOrderData = {
      orderNumber: orderNumber, // <-- Include generated number
      customer: customer._id,
      package: selectedPackageDoc._id,
      packageName: packageName,
      packagePrice: packagePrice,
      deliveryDays: deliveryDays,
      startDate: startDate,
      endDate: endDate,
      status: OrderStatus.ACTIVE,
      deliveryAddress: deliveryAddress,
      paymentDetails: paymentDetails,
    };

    // 5. Create the Order document
    console.log(`[OrderService] Attempting to create order in database...`);
    const createdOrders = await Order.create([newOrderData], {
      session: session,
    });
    if (!createdOrders || createdOrders.length === 0) {
      throw new Error(
        "Database failed to return created order document after Order.create()."
      );
    }
    const newOrder = createdOrders[0];
    console.log(
      `[OrderService] Order document created in DB with ID: ${newOrder._id}, Order Number: ${newOrder.orderNumber}`
    );

    // 6. Commit the transaction
    console.log(`[OrderService] Attempting to commit transaction...`);
    await session.commitTransaction();
    console.log(`[OrderService] Transaction committed successfully.`);
    session.endSession();

    console.log(
      `[OrderService] Order ${newOrder.orderNumber} fully processed.`
    );
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
    session.endSession();

    if (error instanceof Error) {
      if (!(error as any).statusCode) {
        (error as any).statusCode = 500;
      }
      throw error;
    } else {
      const unknownError = new Error(
        "An unknown error occurred during order creation."
      );
      (unknownError as any).statusCode = 500;
      throw unknownError;
    }
  }
};
