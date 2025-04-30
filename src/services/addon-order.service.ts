// src/services/addon-order.service.ts
import mongoose from "mongoose";
import {
  AddonOrder,
  IAddonOrder,
  IAddonOrderItem,
} from "../models/AddonOrder.model.js";
import { Order, IOrder, OrderStatus } from "../models/Order.model.js";
import { Addon as AddonModel } from "../models/addon.model.js";
import { Customer } from "../models/Customer.model.js";
import { stripe } from "../utils/stripe.js";
import { DeliveryStatus } from "../models/Order.model.js"; // Import enum

// Interface for the input data structure from controller
interface InitiateAddonOrderInput {
  originalOrderId: string;
  deliveryDate: string; // ISO Date string
  addons: { addonId: string; quantity: number }[];
}

export class AddonOrderService {
  /**
   * Initiates addon order, calculates total, creates Stripe Payment Intent,
   * and saves a preliminary AddonOrder document.
   */
  // --- MODIFIED: Accepts plain object 'data' instead of DTO class ---
  async initiateAddonOrder(
    userId: string,
    data: InitiateAddonOrderInput
  ): Promise<{ clientSecret: string | null; addonOrderId: string }> {
    console.log(
      `[AddonOrderService] Initiating addon order for user: ${userId}`,
      data
    );
    // Destructure from the plain 'data' object
    const { originalOrderId, deliveryDate, addons: addonInputs } = data;

    // --- Validation and Data Fetching (Remains mostly the same) ---
    const [originalOrder, customer] = await Promise.all([
      Order.findOne({ _id: originalOrderId, customer: userId }).lean(),
      Customer.findById(userId).select("stripeCustomerId").lean(),
    ]);

    if (!originalOrder)
      throw new Error(
        `Original order ${originalOrderId} not found or does not belong to user ${userId}.`
      );
    if (!customer) throw new Error(`Customer ${userId} not found.`);
    if (!customer.stripeCustomerId)
      throw new Error(`Customer ${userId} missing Stripe customer ID.`);

    if (originalOrder.status !== OrderStatus.ACTIVE) {
      // Use OrderStatus.ACTIVE value
      throw new Error(`Original order ${originalOrderId} is not Active.`);
    }
    const requestedDeliveryDate = new Date(deliveryDate);
    const orderEndDate = new Date(originalOrder.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDeliveryDate < today || requestedDeliveryDate > orderEndDate) {
      throw new Error(
        `Requested delivery date ${deliveryDate} is outside the valid range for the original order.`
      );
    }

    // Fetch Addon Details & Calculate Total (Remains the same)
    const addonIds = addonInputs.map((item) => item.addonId);
    const addonDocs = await AddonModel.find({ _id: { $in: addonIds } }).lean();
    let totalAmount = 0; // In cents
    const orderAddonItems: IAddonOrderItem[] = [];
    for (const inputItem of addonInputs) {
      /* ... logic to calculate total and build orderAddonItems ... */
      const addonDoc = addonDocs.find(
        (doc) => doc._id.toString() === inputItem.addonId
      );
      if (!addonDoc)
        throw new Error(`Addon with ID ${inputItem.addonId} not found.`);
      const priceInCents = Math.round(addonDoc.price * 100);
      totalAmount += priceInCents * inputItem.quantity;
      orderAddonItems.push({
        addonId: new mongoose.Types.ObjectId(addonDoc._id.toString()),
        name: addonDoc.name,
        price: priceInCents,
        quantity: inputItem.quantity,
        image: addonDoc.image,
      });
    }
    if (totalAmount <= 50) {
      // Stripe minimum charge might apply (e.g., 50 cents)
      throw new Error(
        `Calculated total amount ($${(totalAmount / 100).toFixed(2)}) is too low.`
      );
    }

    // Create Stripe Payment Intent (Remains the same)
    console.log(`[AddonOrderService] Creating Stripe Payment Intent...`);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: "cad",
      customer: customer.stripeCustomerId,
      payment_method_types: ["card"],
      metadata: {
        userId: userId.toString(),
        originalOrderId: originalOrderId.toString(),
        addonItemCount: addonInputs.length.toString(),
      },
      description: `Addon order for Order #${originalOrder.orderNumber || originalOrderId}`,
    });
    console.log(
      `[AddonOrderService] Payment Intent created: ${paymentIntent.id}`
    );

    // Create Preliminary AddonOrder (Remains the same, using transaction)
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log(`[AddonOrderService] DB Transaction started.`);
    try {
      const newAddonOrderData = {
        originalOrderId: originalOrder._id,
        customer: customer._id,
        deliveryDate: requestedDeliveryDate,
        addons: orderAddonItems,
        totalAmount: totalAmount,
        currency: "cad",
        paymentStatus: "Pending",
        stripePaymentIntentId: paymentIntent.id,
        deliveryStatus: DeliveryStatus.PENDING_ASSIGNMENT, // Use imported enum
        deliveryAddress: originalOrder.deliveryAddress,
      };
      const createdAddonOrders = await AddonOrder.create([newAddonOrderData], {
        session,
      });
      const newAddonOrder = createdAddonOrders[0];
      console.log(
        `[AddonOrderService] Preliminary AddonOrder created: ${newAddonOrder._id}`
      );
      try {
        await stripe.paymentIntents.update(paymentIntent.id, {
          metadata: {
            ...paymentIntent.metadata,
            addonOrderId: newAddonOrder.id.toString(),
          },
        });
      } catch (stripeUpdateError) {
        console.warn(
          `[AddonOrderService] Could not update PI metadata:`,
          stripeUpdateError
        );
      }
      await session.commitTransaction();
      console.log(`[AddonOrderService] DB Transaction committed.`);
      session.endSession();
      return {
        clientSecret: paymentIntent.client_secret,
        addonOrderId: newAddonOrder.id.toString(),
      };
    } catch (dbError) {
      console.error(
        "[AddonOrderService] Error during DB transaction, aborting:",
        dbError
      );
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      throw dbError;
    }
  }

  /**
   * Confirms addon order payment after successful Stripe webhook event.
   */
  // --- This function remains the same ---
  async confirmAddonOrderPayment(stripePaymentIntentId: string): Promise<void> {
    console.log(
      `[AddonOrderService] Attempting to confirm payment for PI: ${stripePaymentIntentId}`
    );
    const addonOrder = await AddonOrder.findOne({
      stripePaymentIntentId: stripePaymentIntentId,
    });
    // ... (rest of confirmation logic: check if exists, check status, update status, save) ...
    if (!addonOrder) {
      console.error(
        `[AddonOrderService] CRITICAL: AddonOrder not found for PI: ${stripePaymentIntentId}.`
      );
      return;
    }
    if (addonOrder.paymentStatus === "Succeeded") {
      console.log(
        `[AddonOrderService] Payment for ${addonOrder._id} already confirmed.`
      );
      return;
    }
    if (addonOrder.paymentStatus !== "Pending") {
      console.warn(
        `[AddonOrderService] AddonOrder ${addonOrder._id} has unexpected status '${addonOrder.paymentStatus}'.`
      );
      return;
    }
    addonOrder.paymentStatus = "Succeeded";
    addonOrder.deliveryStatus = DeliveryStatus.PENDING_ASSIGNMENT;
    try {
      await addonOrder.save();
      console.log(
        `[AddonOrderService] Confirmed payment for ${addonOrder._id}`
      );
    } catch (error) {
      console.error(
        `[AddonOrderService] Failed to save ${addonOrder._id} after confirming payment:`,
        error
      );
    }
  }
}
