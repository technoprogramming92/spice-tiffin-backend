// src/services/order.service.ts

import { Customer } from "../models/Customer.model.js"; // Adjust path
import { Package, IPackage } from "../models/Package.model.js"; // Adjust path
import {
  Order,
  IOrder,
  OrderStatus,
  IDeliveryAddress, // Keep this import
  IPaymentDetails, // Keep this import
  DeliveryStatus, // Import the new enum
} from "../models/Order.model.js"; // Adjust path
import mongoose from "mongoose";
import { geocodeAddress, GeocodeResult } from "../utils/geocode.js"; // <-- Import the new utility

// Interface for parameters passed to the service function
interface CreateOrderParams {
  userId: string;
  packageId: string;
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  amountPaid: number; // Amount in smallest currency unit (e.g., cents)
  currency: string;
  paymentMethodDetails?: {
    // Optional details from Stripe
    type?: string;
    card?: {
      brand?: string;
      last4?: string;
    };
  };
}

// Helper function to generate order number (keep as is)
function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `SBF-${year}${month}${day}-${randomPart}`;
}

/**
 * Creates an Order document in the database after a successful Stripe payment.
 * Includes geocoding the delivery address.
 *
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
    // 1. Fetch Customer and Package (within transaction)
    console.log(`[OrderService] Fetching customer ${userId}...`);
    const customer = await Customer.findById(userId).session(session);
    if (!customer) {
      throw new Error(`Customer not found for ID: ${userId}`);
    }
    console.log(`[OrderService] Customer found: ${customer.fullName}`);

    console.log(`[OrderService] Fetching package ${packageId}...`);
    const selectedPackageDoc =
      await Package.findById(packageId).session(session);
    if (!selectedPackageDoc) {
      throw new Error(`Package not found for ID: ${packageId}`);
    }
    const selectedPackage = selectedPackageDoc.toObject<IPackage>(); // Use toObject if needed
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
      throw new Error(`Invalid data type found for package ${packageId}.`);
    }

    // 2. Verify Payment Amount (keep as is)
    const expectedAmountCents = Math.round(packagePrice * 100);
    console.log(
      `[OrderService] Verifying amount. Expected (cents): ${expectedAmountCents}, Paid (cents): ${amountPaid}`
    );
    if (amountPaid !== expectedAmountCents) {
      throw new Error(
        `Payment amount mismatch. Expected ${expectedAmountCents}, received ${amountPaid}`
      );
    }
    console.log(`[OrderService] Amount verified.`);

    // 3. Check for existing order (Idempotency - check using paymentDetails sub-document)
    console.log(
      `[OrderService] Checking for existing order with paymentIntent ID: ${stripePaymentIntentId}...`
    );
    // --- Ensure query path matches the schema ---
    const existingOrder = await Order.findOne({
      "paymentDetails.stripePaymentIntentId": stripePaymentIntentId, // Query nested field
    }).session(session);
    // --- End Ensure query path ---
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

    // 4. Prepare Address and Payment Details (Sub-documents)
    const baseDeliveryAddress: IDeliveryAddress = {
      address: customer.address, // Assuming these fields exist on Customer model
      city: customer.city,
      postalCode: customer.postalCode,
      currentLocation: customer.currentLocation,
    };

    // --- NEW: Geocode the Address ---
    console.log(`[OrderService] Geocoding delivery address...`);
    const coordinates: GeocodeResult | null =
      await geocodeAddress(baseDeliveryAddress);
    if (coordinates) {
      baseDeliveryAddress.latitude = coordinates.latitude;
      baseDeliveryAddress.longitude = coordinates.longitude;
      console.log(`[OrderService] Geocoding successful.`);
    } else {
      // Decide what to do if geocoding fails:
      // Option A: Log warning and continue without coordinates
      console.warn(
        `[OrderService] Geocoding failed for address. Order will be created without coordinates.`
      );
      // Option B: Throw an error and fail the order creation (might be too strict)
      // throw new Error('Failed to geocode delivery address. Cannot create order.');
    }
    // --- End Geocoding ---

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

    // 5. Prepare Full Order Data
    console.log(`[OrderService] Preparing new order data...`);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date(
      startDate.getTime() + deliveryDays * 24 * 60 * 60 * 1000
    );
    const orderNumber = generateOrderNumber();
    console.log(`[OrderService] Generated Order Number: ${orderNumber}`);

    const newOrderData = {
      orderNumber: orderNumber,
      customer: customer._id,
      package: selectedPackageDoc._id,
      packageName: packageName,
      packagePrice: packagePrice,
      deliveryDays: deliveryDays,
      startDate: startDate,
      endDate: endDate,
      status: OrderStatus.ACTIVE, // Use the enum
      deliveryAddress: baseDeliveryAddress, // Includes coordinates if found
      paymentDetails: paymentDetails,
      // Default values for new delivery fields are set by the schema
      // assignedDriver: null,
      // deliveryStatus: DeliveryStatus.PENDING_ASSIGNMENT,
      // deliverySequence: null,
      // proofOfDeliveryUrl: undefined,
    };

    // 6. Create the Order document (within transaction)
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

    // 7. Commit the transaction
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
    session.endSession(); // Always end the session

    // Re-throw the error to be handled by the calling function (e.g., webhook controller)
    if (error instanceof Error) {
      if (!(error as any).statusCode) {
        // Add statusCode if missing
        (error as any).statusCode = 500;
      }
      throw error;
    } else {
      // Handle non-Error objects being thrown
      const unknownError = new Error(
        "An unknown error occurred during order creation."
      );
      (unknownError as any).statusCode = 500;
      throw unknownError;
    }
  }
};
