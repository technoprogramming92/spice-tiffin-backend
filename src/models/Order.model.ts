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

// Interface for nested payment details
export interface IPaymentDetails {
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  amountPaid: number;
  currency: string;
  paymentMethodType?: string;
  cardBrand?: string;
  cardLast4?: string;
  paymentDate: Date;
}

// Interface defining the Order document structure
export interface IOrder extends Document {
  orderNumber: string;
  customer: Types.ObjectId | ICustomer;
  package: Types.ObjectId | IPackage;
  packageName: string;
  packagePrice: number;
  deliveryDays: number;
  startDate: Date;
  endDate: Date;
  status: OrderStatus;
  deliveryAddress: IDeliveryAddress;
  paymentDetails: IPaymentDetails;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose Schema Definition
const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true, // Keep required validation
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
    paymentDetails: {
      type: {
        stripePaymentIntentId: {
          type: String,
          required: true,
          unique: true,
          index: true,
        },
        stripeCustomerId: { type: String, required: true, index: true },
        amountPaid: { type: Number, required: true },
        currency: { type: String, required: true, default: "cad" },
        paymentMethodType: { type: String },
        cardBrand: { type: String },
        cardLast4: { type: String },
        paymentDate: { type: Date, required: true, default: Date.now },
      },
      required: true,
      _id: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create and export the Order model
export const Order = mongoose.model<IOrder>("Order", orderSchema);
