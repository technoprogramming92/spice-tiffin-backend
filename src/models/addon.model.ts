// src/models/addon.model.ts

import { Schema, model, Document } from "mongoose";

// 1. Define the TypeScript interface for the Addon document
export interface IAddon extends Document {
  name: string;
  price: number;
  image: string; // Stores the URL or path to the image
  // Timestamps will be added by Mongoose automatically
  createdAt: Date;
  updatedAt: Date;
}

// 2. Create the Mongoose Schema corresponding to the interface
const addonSchema = new Schema<IAddon>(
  {
    name: {
      type: String,
      required: [true, "Addon name is required."], // Mark as required
      trim: true, // Remove leading/trailing whitespace
      unique: true, // Ensure addon names are unique (optional, remove if not needed)
    },
    price: {
      type: Number,
      required: [true, "Addon price is required."],
      min: [0, "Price cannot be negative."], // Ensure price is not negative
    },
    image: {
      type: String,
      required: [true, "Addon image URL or path is required."], // Assuming image is mandatory
    },
  },
  {
    // 3. Enable timestamps
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    toJSON: { virtuals: true }, // Optional: ensure virtuals are included if you add any later
    toObject: { virtuals: true }, // Optional: ensure virtuals are included if you add any later
  }
);

// 4. Create and export the Mongoose model
// Mongoose will create/use a collection named 'addons' (pluralized, lowercased)
export const Addon = model<IAddon>("Addon", addonSchema);

export default Addon;
