// services/order.service.ts
import { Customer, ICustomer } from "../models/Customer.model.js";
import { Package, IPackage } from "../models/Package.model.js";
import {
  Order,
  IOrder,
  OrderStatus,
  IDeliveryAddress,
} from "../models/Order.model.js";
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
    `[OrderService] Attempting to create order for user: ${userId}, package: ${packageId}`
  );

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch Customer and Package
    const customer = await Customer.findById(userId).session(session);
    if (!customer) {
      const error = new Error(`Customer not found for ID: ${userId}`);
      (error as any).statusCode = 404;
      throw error;
    }

    const selectedPackageDoc =
      await Package.findById(packageId).session(session);
    if (!selectedPackageDoc) {
      const error = new Error(`Package not found for ID: ${packageId}`);
      (error as any).statusCode = 404;
      throw error;
    }

    // --- FIX: Use .toObject() before accessing properties ---
    // Convert Mongoose document to a plain object matching IPackage interface
    const selectedPackage = selectedPackageDoc.toObject<IPackage>();

    // Now access properties from the plain object
    const deliveryDays = selectedPackage.days; // Access 'days' field from model
    const packagePrice = selectedPackage.price;
    const packageName = selectedPackage.name;

    // Optional runtime type check remains useful
    if (
      typeof deliveryDays !== "number" ||
      typeof packagePrice !== "number" ||
      typeof packageName !== "string"
    ) {
      console.error("Package data types are incorrect after fetch/toObject:", {
        deliveryDays,
        packagePrice,
        packageName,
      });
      const typeError = new Error(
        `Invalid data type found for package ${packageId}.`
      );
      (typeError as any).statusCode = 500;
      throw typeError;
    }
    // --- End Fix ---

    // 2. Verify Payment Amount
    const expectedAmountCents = Math.round(packagePrice * 100);
    if (amountPaid !== expectedAmountCents) {
      console.warn(
        `[OrderService] Payment amount mismatch. Expected: ${expectedAmountCents}, Paid: ${amountPaid}`
      );
      const error = new Error(
        `Payment amount mismatch. Expected ${expectedAmountCents}, received ${amountPaid}`
      );
      (error as any).statusCode = 400;
      throw error;
    }

    // 3. Check for existing order (Idempotency)
    const existingOrder = await Order.findOne({
      "paymentDetails.stripePaymentIntentId": stripePaymentIntentId,
    }).session(session);
    if (existingOrder) {
      console.warn(
        `[OrderService] Duplicate webhook event. Order already exists for payment intent ID: ${stripePaymentIntentId}.`
      );
      await session.abortTransaction();
      session.endSession();
      return existingOrder;
    }

    // 4. Prepare Order Data
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

    const paymentDetails = {
      stripePaymentIntentId: stripePaymentIntentId,
      stripeCustomerId: stripeCustomerId,
      amountPaid: amountPaid,
      currency: currency.toLowerCase(),
      paymentMethodType: paymentMethodDetails?.type,
      cardBrand: paymentMethodDetails?.card?.brand,
      cardLast4: paymentMethodDetails?.card?.last4,
      paymentDate: new Date(),
    };

    // 5. Create the Order document
    const newOrderData = {
      customer: customer._id,
      package: selectedPackageDoc._id, // Use original doc ID
      packageName: packageName,
      packagePrice: packagePrice,
      deliveryDays: deliveryDays, // Use variable derived from 'days'
      startDate: startDate,
      endDate: endDate,
      status: OrderStatus.ACTIVE,
      deliveryAddress: deliveryAddress,
      paymentDetails: paymentDetails,
      // orderNumber generated by pre-save hook
    };

    const createdOrders = await Order.create([newOrderData], {
      session: session,
    });
    if (!createdOrders || createdOrders.length === 0) {
      throw new Error("Database failed to return created order document.");
    }
    const newOrder = createdOrders[0];

    console.log(
      `[OrderService] Order ${newOrder.orderNumber} created successfully.`
    );

    // 6. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return newOrder;
  } catch (error) {
    console.error(
      "[OrderService] Error during order creation, aborting transaction:",
      error
    );
    await session.abortTransaction();
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
