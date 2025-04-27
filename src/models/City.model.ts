// models/City.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

// Interface defining the City document structure
export interface ICity extends Document {
  _id: Types.ObjectId;
  name: string; // Name of the city where delivery is possible
  createdAt: Date; // Mongoose timestamp
  updatedAt: Date; // Mongoose timestamp
}

// Mongoose Schema Definition
const citySchema = new Schema<ICity>(
  {
    name: {
      type: String,
      required: [true, "City name is required"],
      unique: true, // Ensure city names are unique
      trim: true, // Remove leading/trailing whitespace
      // Example: Add a reasonable max length if desired
      // maxlength: [100, "City name cannot exceed 100 characters"]
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt
  }
);

// Add index to enforce uniqueness efficiently
citySchema.index({ name: 1 }, { unique: true });

// Create and export the City model
export const City = mongoose.model<ICity>("City", citySchema);
