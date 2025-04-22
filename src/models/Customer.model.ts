// Purpose: Mongoose schema and model for customer registration
import mongoose, { Schema, Document } from "mongoose";

export interface ICustomer extends Document {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  verification: boolean;
  otpSessionId?: string;
  otpCode?: string;
  stripeCustomerId?: string;
  otpExpiresAt?: Date;
  address?: string;
  city?: string;
  postalCode?: string;
  currentLocation?: string;
}

const customerSchema = new Schema<ICustomer>(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verification: { type: Boolean, default: false },
    otpSessionId: { type: String },
    otpCode: { type: String },
    stripeCustomerId: { type: String, default: null },
    otpExpiresAt: { type: Date },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    currentLocation: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Customer = mongoose.model<ICustomer>("Customer", customerSchema);
