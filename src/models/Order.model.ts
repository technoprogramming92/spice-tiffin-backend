// src/models/Order.model.ts

import mongoose, { Schema, Document, Model, Types } from "mongoose";

// --- Define Delivery Status Enum ---
// Using an enum helps enforce allowed values
export enum DeliveryStatus {
  PENDING_ASSIGNMENT = "Pending Assignment",
  ASSIGNED = "Assigned",
  OUT_FOR_DELIVERY = "Out for Delivery", // Driver has started the route / picked up
  DELIVERED = "Delivered", // Successfully completed
  FAILED = "Failed", // Delivery attempted but failed
  CANCELLED = "Cancelled", // Order cancelled before/during delivery
}

// --- Interface for the Delivery Address Sub-document ---
interface IDeliveryAddress {
  address?: string;
  city?: string;
  postalCode?: string;
  currentLocation?: string; // Optional, from original schema
  // --- NEW: Geolocation Coordinates ---
  latitude?: number; // Added for mapping & routing
  longitude?: number; // Added for mapping & routing
  // Optional: Add GeoJSON structure later if complex spatial queries are needed
  // location?: {
  //   type: { type: String, enum: ['Point'], default: 'Point' };
  //   coordinates: { type: [Number], index: '2dsphere' }; // [longitude, latitude]
  // };
}

// --- Interface representing an Order document ---
export interface IOrder extends Document {
  orderNumber: string;
  customer: Types.ObjectId; // Reference to Customer model
  package: Types.ObjectId; // Reference to Package model
  packageName: string;
  packagePrice: number;
  deliveryDays: number;
  startDate: Date;
  endDate: Date;
  status: "Active" | "Expired" | "Cancelled"; // Original order status
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  deliveryAddress: IDeliveryAddress; // Use the sub-document interface
  createdAt: Date;
  updatedAt: Date;

  // --- NEW: Delivery Management Fields ---
  assignedDriver: Types.ObjectId | null; // Reference to Driver model, null if unassigned
  deliveryStatus: DeliveryStatus; // Enum for detailed delivery lifecycle status
  deliverySequence: number | null; // Order sequence in an optimized route, null if not sequenced
  proofOfDeliveryUrl?: string; // URL of the uploaded proof image
}

// Interface for the Order model statics (optional)
export interface IOrderModel extends Model<IOrder> {}

// --- Mongoose Schema Definition ---
const orderSchema = new Schema<IOrder, IOrderModel>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer", // Ensure 'Customer' matches your customer model name
      required: true,
      index: true,
    },
    package: {
      type: Schema.Types.ObjectId,
      ref: "Package", // Ensure 'Package' matches your package model name
      required: true,
    },
    packageName: { type: String, required: true },
    packagePrice: { type: Number, required: true },
    deliveryDays: { type: Number, required: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ["Active", "Expired", "Cancelled"], // Keep original status if needed, or integrate with deliveryStatus
      default: "Active",
      index: true,
    },
    stripePaymentIntentId: { type: String, required: true, unique: true },
    stripeCustomerId: { type: String, required: true, index: true },
    deliveryAddress: {
      // Define the sub-document structure
      address: { type: String },
      city: { type: String },
      postalCode: { type: String },
      currentLocation: { type: String }, // Optional from original
      // --- NEW: Geo Coordinates ---
      latitude: { type: Number }, // Store as number
      longitude: { type: Number }, // Store as number
    },

    // --- NEW: Delivery Management Fields ---
    assignedDriver: {
      type: Schema.Types.ObjectId,
      ref: "Driver", // Ensure 'Driver' matches your driver model name
      default: null, // Default to null (unassigned)
      index: true, // Index for easily querying by driver
    },
    deliveryStatus: {
      type: String,
      enum: Object.values(DeliveryStatus), // Use enum values
      default: DeliveryStatus.PENDING_ASSIGNMENT, // Default for new orders
      index: true, // Index for querying by status
    },
    deliverySequence: {
      type: Number,
      default: null, // Default to null (not sequenced)
    },
    proofOfDeliveryUrl: {
      type: String, // Store the URL from cloud storage
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// --- Optional: Define virtuals or methods if needed ---

// --- Export the Model ---
export const Order: IOrderModel = mongoose.model<IOrder, IOrderModel>(
  "Order",
  orderSchema
);
