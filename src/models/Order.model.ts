// models/Order.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import { ICustomer } from "./Customer.model.js";
import { IPackage } from "./Package.model.js";

// Define possible order statuses
export enum OrderStatus {
  ACTIVE = "Active",
  EXPIRED = "Expired",
  CANCELLED = "Cancelled",
}

// Interface for the nested delivery address
export interface IDeliveryAddress {
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  currentLocation?: string | null;
}

// --- NEW: Interface for nested payment details ---
export interface IPaymentDetails {
  stripePaymentIntentId: string; // ID from successful Stripe payment (moved here)
  stripeCustomerId: string; // Associated Stripe Customer ID (moved here)
  amountPaid: number; // Amount paid in smallest currency unit (e.g., cents)
  currency: string; // Currency code (e.g., 'cad')
  paymentMethodType?: string; // e.g., 'card' (from Stripe)
  cardBrand?: string; // e.g., 'visa', 'mastercard' (if available)
  cardLast4?: string; // Last 4 digits of the card (if available)
  paymentDate: Date; // Timestamp of successful payment (usually close to createdAt)
}

// Interface defining the Order document structure
export interface IOrder extends Document {
  orderNumber: string;
  customer: Types.ObjectId | ICustomer;
  package: Types.ObjectId | IPackage;
  packageName: string;
  packagePrice: number; // Price in standard currency unit (e.g., 19.99 CAD)
  deliveryDays: number;
  startDate: Date;
  endDate: Date;
  status: OrderStatus;
  deliveryAddress: IDeliveryAddress;
  // --- CHANGE: Payment details are now nested ---
  paymentDetails: IPaymentDetails;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose Schema Definition
const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    package: {
      type: Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },
    packageName: {
      type: String,
      required: true,
      trim: true,
    },
    packagePrice: {
      // Price in e.g., 19.99 CAD
      type: Number,
      required: true,
      min: [0, "Package price cannot be negative"],
    },
    deliveryDays: {
      type: Number,
      required: true,
      min: [1, "Delivery days must be at least 1"],
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
      default: OrderStatus.ACTIVE,
      index: true,
    },
    deliveryAddress: {
      type: {
        address: { type: String, trim: true },
        city: { type: String, trim: true },
        postalCode: { type: String, trim: true },
        currentLocation: { type: String, trim: true },
      },
      required: true,
      _id: false,
    },
    // --- CHANGE: Nested Payment Details ---
    paymentDetails: {
      type: {
        stripePaymentIntentId: {
          type: String,
          required: true,
          unique: true,
          index: true,
        },
        stripeCustomerId: { type: String, required: true, index: true },
        amountPaid: { type: Number, required: true }, // Store amount in cents
        currency: { type: String, required: true, default: "cad" }, // Default to CAD
        paymentMethodType: { type: String },
        cardBrand: { type: String },
        cardLast4: { type: String },
        paymentDate: { type: Date, required: true, default: Date.now }, // Record payment time
      },
      required: true,
      _id: false, // Don't create a separate _id for the subdocument
    },
    // --- Removed standalone stripePaymentIntentId and stripeCustomerId ---
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt for the Order itself
  }
);

// Pre-save hook for order number generation (Keep existing)
orderSchema.pre<IOrder>("save", async function (next) {
  if (this.isNew && !this.orderNumber) {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderNumber = `SBF-${year}${month}${day}-${randomPart}`;
  }
  next();
});

// Indexes are defined inline via `index: true` or `unique: true`

// Create and export the Order model
export const Order = mongoose.model<IOrder>("Order", orderSchema);
