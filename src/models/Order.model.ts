// src/models/Order.model.ts

import mongoose, { Schema, Document, Model, Types } from "mongoose";

// --- Define and Export Delivery Status Enum ---
// Ensure other files import THIS name
export enum DeliveryStatus {
  PENDING_ASSIGNMENT = "Pending Assignment",
  ASSIGNED = "Assigned",
  OUT_FOR_DELIVERY = "Out for Delivery",
  DELIVERED = "Delivered",
  FAILED = "Failed",
  CANCELLED = "Cancelled",
}

// --- Define and EXPORT Delivery Address Interface ---
export interface IDeliveryAddress {
  // <--- Added export
  address?: string;
  city?: string;
  postalCode?: string;
  currentLocation?: string;
  latitude?: number;
  longitude?: number;
}

// --- Define and EXPORT Order Interface ---
export interface IOrder extends Document {
  // <--- Added export
  orderNumber: string;
  customer: Types.ObjectId;
  package: Types.ObjectId;
  packageName: string;
  packagePrice: number;
  deliveryDays: number;
  startDate: Date;
  endDate: Date;
  status: "Active" | "Expired" | "Cancelled";
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  deliveryAddress: IDeliveryAddress;
  createdAt: Date;
  updatedAt: Date;
  assignedDriver: Types.ObjectId | null;
  deliveryStatus: DeliveryStatus;
  deliverySequence: number | null;
  proofOfDeliveryUrl?: string;
}

// Interface for the Order model statics (optional, export if needed elsewhere)
export interface IOrderModel extends Model<IOrder> {} // <--- Added export

// --- Mongoose Schema Definition ---
// Schema definition remains the same as before...
const orderSchema = new Schema<IOrder, IOrderModel>(
  {
    orderNumber: { type: String, required: true, unique: true },
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
    endDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ["Active", "Expired", "Cancelled"],
      default: "Active",
      index: true,
    },
    stripePaymentIntentId: { type: String, required: true, unique: true },
    stripeCustomerId: { type: String, required: true, index: true },
    deliveryAddress: {
      address: { type: String },
      city: { type: String },
      postalCode: { type: String },
      currentLocation: { type: String },
      latitude: { type: Number },
      longitude: { type: Number },
    },
    assignedDriver: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: Object.values(DeliveryStatus),
      default: DeliveryStatus.PENDING_ASSIGNMENT,
      index: true,
    },
    deliverySequence: { type: Number, default: null },
    proofOfDeliveryUrl: { type: String },
  },
  { timestamps: true }
);

// --- Export the Model ---
export const Order: IOrderModel = mongoose.model<IOrder, IOrderModel>(
  "Order",
  orderSchema
);
