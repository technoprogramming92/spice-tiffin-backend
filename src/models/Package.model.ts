import mongoose, { Schema, Document } from "mongoose";

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
  image?: string;
  days: number;
  createdAt: Date;
  updatedAt: Date;
}

const packageSchema = new Schema<IPackage>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    price: { type: Number, required: true },
    type: {
      type: String,
      enum: Object.values(PackageType),
      required: true,
    },
    image: { type: String },
    days: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Package = mongoose.model<IPackage>("Package", packageSchema);
