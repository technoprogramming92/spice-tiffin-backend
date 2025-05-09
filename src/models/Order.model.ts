// src/models/Order.model.ts

import mongoose, { Schema, Document, Model, Types } from "mongoose";
// Assuming Customer and Package models/interfaces are imported correctly
import { ICustomer } from "./Customer.model.js";
import { IPackage } from "./Package.model.js";

/**
 * @description Enum for the overall order/subscription status.
 */
export enum OrderStatus {
  ACTIVE = "Active",
  EXPIRED = "Expired", // When endDate passes or deliveries are implicitly complete
  CANCELLED = "Cancelled", // Manually cancelled by admin or due to payment failure etc.
}

/**
 * @description Interface for the Delivery Address sub-document.
 * Includes geocoordinates obtained during order creation.
 */
export interface IDeliveryAddress {
  address?: string;
  city?: string;
  postalCode?: string;
  currentLocation?: string; // Preserved if needed
  latitude?: number;
  longitude?: number;
}

/**
 * @description Interface for the Payment Details sub-document.
 */
export interface IPaymentDetails {
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  amountPaid: number; // In cents
  currency: string;
  paymentDate?: Date;
  paymentMethodType?: string;
  cardBrand?: string;
  cardLast4?: string;
}

/**
 * @description Interface representing a full Order document in MongoDB.
 */
export interface IOrder extends Document {
  // Core Order Info
  orderNumber: string; // Unique, generated order number
  customer: Types.ObjectId; // Ref to Customer model
  package: Types.ObjectId; // Ref to Package model

  // Denormalized Package Info (at time of order)
  packageName: string;
  packagePrice: number; // Price in cents at time of order
  deliveryDays: number; // Total number of deliveries expected for this package

  // Delivery Scheduling & Duration
  startDate: Date; // Date of the FIRST actual delivery (UTC Midnight)
  endDate: Date; // Date of the LAST actual delivery (UTC Midnight)
  deliverySchedule: Date[]; // Array containing all scheduled delivery dates (UTC Midnight)

  // Overall Order Status
  status: OrderStatus;

  // Delivery Execution Info (Managed by Admin)
  assignedDriver: Types.ObjectId | null; // Ref to Driver/User model

  // Sub-documents
  deliveryAddress: IDeliveryAddress; // Customer's address at time of order
  paymentDetails: IPaymentDetails; // Payment info for this order

  // Timestamps
  createdAt: Date; // Order placement/creation time
  updatedAt: Date;
}

// Interface for static methods on the Order model (optional)
export interface IOrderModel extends Model<IOrder> {}

// --- Mongoose Schema Definition ---

const deliveryAddressSchema = new Schema<IDeliveryAddress>(
  {
    address: { type: String },
    city: { type: String },
    postalCode: { type: String },
    currentLocation: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { _id: false } // No separate _id
);

const paymentDetailsSchema = new Schema<IPaymentDetails>(
  {
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    stripeCustomerId: { type: String, required: true, index: true },
    amountPaid: { type: Number, required: true }, // Store in cents
    currency: { type: String, required: true },
    paymentDate: { type: Date, default: Date.now },
    paymentMethodType: { type: String },
    cardBrand: { type: String },
    cardLast4: { type: String },
  },
  { _id: false } // No separate _id
);

// Main Order schema
const orderSchema = new Schema<IOrder, IOrderModel>(
  {
    // Core fields
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    package: { type: Schema.Types.ObjectId, ref: "Package", required: true },

    // Denormalized Package Info
    packageName: { type: String, required: true },
    packagePrice: { type: Number, required: true }, // Store in cents
    deliveryDays: { type: Number, required: true, min: 1 }, // Number of deliveries

    // Scheduling
    startDate: { type: Date, required: true, index: true }, // First actual delivery date
    endDate: { type: Date, required: true, index: true }, // Last actual delivery date
    deliverySchedule: { type: [Date], required: true }, // Array of specific delivery dates

    // Overall Status
    status: {
      type: String,
      required: true,
      enum: Object.values(OrderStatus),
      default: OrderStatus.ACTIVE,
      index: true,
    },

    // Delivery Assignment
    assignedDriver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    }, // Assuming Driver is a User with 'driver' role

    // Sub-documents
    deliveryAddress: { type: deliveryAddressSchema, required: true },
    paymentDetails: { type: paymentDetailsSchema, required: true },
  },
  {
    timestamps: true, // Adds createdAt, updatedAt
  }
);

// Ensure dates in deliverySchedule are stored correctly (UTC Midnight)
// Pre-save hook might be less ideal here as it's an array.
// Best to ensure dates pushed into the array are already normalized before saving.

export const Order: IOrderModel = mongoose.model<IOrder, IOrderModel>(
  "Order",
  orderSchema
);
