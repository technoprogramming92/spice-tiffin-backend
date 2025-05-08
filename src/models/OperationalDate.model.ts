// src/models/OperationalDate.model.ts

import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * @interface IOperationalDate
 * @description Interface representing an operational date setting by an admin.
 * Each document signifies a specific date and whether deliveries are enabled for it.
 */
export interface IOperationalDate extends Document {
  _id: Types.ObjectId;
  date: Date; // Stores the specific date (YYYY-MM-DD). Time component will be set to UTC midnight.
  isDeliveryEnabled: boolean; // True if deliveries are allowed on this date, false otherwise.
  notes?: string; // Optional notes by admin for this specific date.
  setBy?: Types.ObjectId; // Reference to the Admin User who last modified this date setting.
  createdAt: Date;
  updatedAt: Date;
}

// Interface for static methods on the OperationalDate model (if any)
export interface IOperationalDateModel extends Model<IOperationalDate> {}

const operationalDateSchema = new Schema<
  IOperationalDate,
  IOperationalDateModel
>(
  {
    date: {
      type: Date,
      required: true,
      unique: true, // Each date entry should be unique.
      index: true, // Index for efficient querying by date.
    },
    isDeliveryEnabled: {
      type: Boolean,
      required: true,
      default: false, // Default to not enabled unless explicitly set.
    },
    notes: {
      type: String,
      trim: true,
    },
    setBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin", // Assuming your admin users are in the 'User' collection with an 'admin' role.
      // required: true, // Consider if this is strictly required or can be optional.
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt.
  }
);

// Pre-save hook to normalize the date to UTC midnight to ensure consistency
// This is crucial for date-only comparisons.
operationalDateSchema.pre<IOperationalDate>("save", function (next) {
  if (this.date) {
    const date = new Date(this.date);
    date.setUTCHours(0, 0, 0, 0);
    this.date = date;
  }
  next();
});

export const OperationalDate: IOperationalDateModel = mongoose.model<
  IOperationalDate,
  IOperationalDateModel
>("OperationalDate", operationalDateSchema);
