import { Schema, model, Document, Types } from "mongoose";

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  stripeCustomerId?: string;
  verification: boolean;
  otpCode?: string;
  otpExpiresAt?: Date;
  otpSessionId?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  currentLocation?: string;
}

const customerSchema = new Schema<ICustomer>({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  mobile: { type: String, required: true },
  password: { type: String, required: true },
  stripeCustomerId: String,
  verification: { type: Boolean, default: false },
  otpCode: String,
  otpExpiresAt: Date,
  otpSessionId: String,
  address: String,
  city: String,
  postalCode: String,
  currentLocation: String,
});

export const Customer = model<ICustomer>("Customer", customerSchema);
