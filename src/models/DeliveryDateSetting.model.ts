// src/models/DeliveryDateSetting.model.ts
import mongoose, { Schema, Document, Model } from "mongoose";

// Interface for the document
export interface IDeliveryDateSetting extends Document {
  date: Date; // The specific date (store as UTC midnight for consistency)
  isEnabled: boolean; // True if delivery is allowed on this date
  notes?: string; // Optional admin notes
  // Timestamps added by schema
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose Schema
const deliveryDateSettingSchema = new Schema<IDeliveryDateSetting>(
  {
    date: {
      type: Date,
      required: true,
      unique: true, // Ensure only one entry per date
      index: true,
      // Custom setter to ensure only date part (UTC midnight) is stored
      set: (d: Date | string) => {
        const date = new Date(d);
        date.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight
        return date;
      },
    },
    isEnabled: {
      type: Boolean,
      required: true,
      default: false,
      index: true, // Index for finding enabled dates quickly
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Export the model
export const DeliveryDateSetting = mongoose.model<IDeliveryDateSetting>(
  "DeliveryDateSetting",
  deliveryDateSettingSchema
);
