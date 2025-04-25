// models/Package.model.ts
import mongoose, { Schema, Document } from "mongoose";
import { ICategory } from "./Category.model.js";

export enum PackageType {
  TRIAL = "trial",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

export interface IPackage extends Document {
  name: string;
  description?: string;
  price: number;
  type: PackageType;
  days: number;
  category: mongoose.Types.ObjectId | ICategory;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const packageSchema = new Schema<IPackage>(
  {
    name: {
      type: String,
      required: [true, "Package name is required"],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Package price is required"],
      min: [0, "Price cannot be negative"],
    },
    type: {
      type: String,
      enum: Object.values(PackageType),
      required: true,
    },
    days: {
      type: Number,
      required: [true, "Days are required for a package"],
      min: [1, "Days must be at least 1"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    image: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Ensure unique package names
packageSchema.index({ name: 1 }, { unique: true });

export const Package = mongoose.model<IPackage>("Package", packageSchema);
