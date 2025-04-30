// src/models/AddonOrder.model.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";
// Assuming OrderStatus enum is suitable, or create a new one if needed
import { DeliveryStatus } from "./Order.model.js"; // Reuse delivery status enum
import { IDeliveryAddress } from "./Order.model.js"; // Reuse address subdocument interface

// Interface for the items within the addon order
export interface IAddonOrderItem {
  addonId: Types.ObjectId;
  name: string; // Denormalized name
  price: number; // Price AT THE TIME OF ORDER (in cents)
  quantity: number;
  image?: string; // Denormalized image URL
}

// Main Addon Order Interface
export interface IAddonOrder extends Document {
  originalOrderId: Types.ObjectId; // Link to the main Order
  customer: Types.ObjectId; // Link to the Customer
  deliveryDate: Date; // Specific date chosen by customer
  addons: IAddonOrderItem[]; // Array of addons in this specific order
  totalAmount: number; // Total cost of addons in this order (in cents)
  currency: string; // e.g., 'cad'
  paymentStatus: "Pending" | "Succeeded" | "Failed"; // Payment status
  stripePaymentIntentId: string; // Stripe Payment Intent ID
  deliveryStatus: DeliveryStatus; // Delivery status for these addons
  deliveryAddress: IDeliveryAddress; // Address snapshot from original order
  createdAt: Date;
  updatedAt: Date;
}

// Interface for static methods (optional)
export interface IAddonOrderModel extends Model<IAddonOrder> {}

// --- Mongoose Schema ---

const addonOrderItemSchema = new Schema<IAddonOrderItem>(
  {
    addonId: { type: Schema.Types.ObjectId, ref: "Addon", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true }, // Price in cents
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String },
  },
  { _id: false }
);

// Re-use Address Schema definition (assuming it's exported or define here if needed)
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
);

const addonOrderSchema = new Schema<IAddonOrder, IAddonOrderModel>(
  {
    originalOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    deliveryDate: { type: Date, required: true, index: true },
    addons: {
      type: [addonOrderItemSchema],
      required: true,
      validate: (v: any) => Array.isArray(v) && v.length > 0,
    }, // Ensure array is not empty
    totalAmount: { type: Number, required: true }, // In cents
    currency: { type: String, required: true, default: "cad" },
    paymentStatus: {
      type: String,
      required: true,
      enum: ["Pending", "Succeeded", "Failed"],
      default: "Pending",
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deliveryStatus: {
      type: String,
      required: true,
      enum: Object.values(DeliveryStatus),
      default: DeliveryStatus.PENDING_ASSIGNMENT,
      index: true,
    },
    deliveryAddress: { type: deliveryAddressSchema, required: true },
  },
  {
    timestamps: true,
  }
);

export const AddonOrder: IAddonOrderModel = mongoose.model<
  IAddonOrder,
  IAddonOrderModel
>("AddonOrder", addonOrderSchema);
