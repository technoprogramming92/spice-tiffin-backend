// src/models/Order.model.ts

import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * @description Enum for the original order status (Active, Expired, Cancelled).
 * This is exported because other backend files (like jobs) might use it.
 */
export enum OrderStatus {
  ACTIVE = "Active",
  EXPIRED = "Expired",
  CANCELLED = "Cancelled",
}

/**
 * @description Enum for the detailed delivery lifecycle status.
 */
export enum DeliveryStatus {
  PENDING_ASSIGNMENT = "Pending Assignment",
  ASSIGNED = "Assigned",
  OUT_FOR_DELIVERY = "Out for Delivery",
  DELIVERED = "Delivered",
  FAILED = "Failed",
  CANCELLED = "Cancelled", // Can represent cancellation during delivery phase
}

/**
 * @description Interface for the Delivery Address sub-document within an Order.
 * Includes geocoordinates for mapping.
 */
export interface IDeliveryAddress {
  address?: string;
  city?: string;
  postalCode?: string;
  currentLocation?: string; // Optional field from previous schema
  latitude?: number; // For mapping & routing
  longitude?: number; // For mapping & routing
}

/**
 * @description Interface for the Payment Details sub-document within an Order.
 * Based on the example document provided.
 */
export interface IPaymentDetails {
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  amountPaid: number; // Assumed to be in cents
  currency: string; // e.g., 'cad'
  paymentDate?: Date; // Optional, added for clarity
  // Optional fields based on Stripe details (if captured)
  paymentMethodType?: string;
  cardBrand?: string;
  cardLast4?: string;
}

/**
 * @description Interface representing a full Order document in MongoDB.
 */
export interface IOrder extends Document {
  // Core Order Info
  orderNumber: string;
  customer: Types.ObjectId; // Ref to Customer
  package: Types.ObjectId; // Ref to Package
  packageName: string; // Denormalized from Package
  packagePrice: number; // Denormalized from Package
  deliveryDays: number; // Denormalized from Package
  startDate: Date;
  endDate: Date;
  status: OrderStatus; // Use the OrderStatus enum

  // Sub-documents
  deliveryAddress: IDeliveryAddress;
  paymentDetails: IPaymentDetails; // Use the IPaymentDetails interface

  // Delivery Management Fields
  assignedDriver: Types.ObjectId | null; // Ref to Driver, null if unassigned
  deliveryStatus: DeliveryStatus; // Use the DeliveryStatus enum
  deliverySequence: number | null; // Sequence in optimized route
  proofOfDeliveryUrl?: string; // URL of uploaded proof image

  // Timestamps (added by schema option)
  createdAt: Date;
  updatedAt: Date;
}

// Interface for static methods on the Order model (optional)
export interface IOrderModel extends Model<IOrder> {}

// --- Mongoose Schema Definition ---

// Define sub-schemas first for better organization
const deliveryAddressSchema = new Schema<IDeliveryAddress>(
  {
    address: { type: String },
    city: { type: String },
    postalCode: { type: String },
    currentLocation: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { _id: false }
); // No separate _id for sub-documents unless needed

const paymentDetailsSchema = new Schema<IPaymentDetails>(
  {
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    }, // Index this for idempotency checks
    stripeCustomerId: { type: String, required: true, index: true },
    amountPaid: { type: Number, required: true }, // Store in cents
    currency: { type: String, required: true },
    paymentDate: { type: Date, default: Date.now }, // Default payment date to now
    paymentMethodType: { type: String },
    cardBrand: { type: String },
    cardLast4: { type: String },
  },
  { _id: false }
);

// Define the main Order schema
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
    packageName: { type: String, required: true },
    packagePrice: { type: Number, required: true },
    deliveryDays: { type: Number, required: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true, index: true }, // Index endDate for expiration job
    status: {
      type: String,
      required: true,
      enum: Object.values(OrderStatus), // Use enum values
      default: OrderStatus.ACTIVE,
      index: true,
    },

    // Sub-documents using defined schemas
    deliveryAddress: { type: deliveryAddressSchema, required: true },
    paymentDetails: { type: paymentDetailsSchema, required: true },

    // Delivery Management fields
    assignedDriver: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: Object.values(DeliveryStatus), // Use enum values
      default: DeliveryStatus.PENDING_ASSIGNMENT,
      index: true,
    },
    deliverySequence: { type: Number, default: null },
    proofOfDeliveryUrl: { type: String },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt
  }
);

// --- Export the Mongoose Model ---
// The model name 'Order' will result in a collection named 'orders' in MongoDB.
export const Order: IOrderModel = mongoose.model<IOrder, IOrderModel>(
  "Order",
  orderSchema
);
