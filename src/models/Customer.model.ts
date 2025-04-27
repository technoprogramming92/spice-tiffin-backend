// models/Customer.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  mobile: string; // Keep mobile number
  password: string;
  stripeCustomerId?: string;
  verification: boolean; // Keep verification flag
  address?: string;
  city?: string;
  postalCode?: string;
  currentLocation?: string;
}

const customerSchema = new Schema<ICustomer>(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true }, // Added unique/index
    mobile: { type: String, required: true, unique: true, index: true }, // Added unique/index
    password: { type: String, required: true },
    stripeCustomerId: { type: String, index: true }, // Index this
    verification: { type: Boolean, default: false },
    address: String,
    city: String,
    postalCode: String,
    currentLocation: String,
  },
  { timestamps: true }
); // Keep timestamps

// Optional: Add compound index if needed
customerSchema.index({ email: 1 });
customerSchema.index({ mobile: 1 });

export const Customer = model<ICustomer>("Customer", customerSchema);
