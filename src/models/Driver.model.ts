// src/models/Driver.model.ts

import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

// Interface representing a driver document (optional but good practice)
export interface IDriver extends Document {
  fullName: string;
  phone: string;
  vehicleNumber: string;
  password?: string; // Optional because it will be excluded by default
  status: "Active" | "Inactive";
  createdAt: Date;
  updatedAt: Date;
  // Method to compare password (added via schema methods)
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Interface representing the static methods of the Driver model (optional)
export interface IDriverModel extends Model<IDriver> {
  // Define static methods here if needed
}

const driverSchema = new Schema<IDriver, IDriverModel>(
  {
    fullName: {
      type: String,
      required: [true, "Driver full name is required."],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Driver phone number is required."],
      unique: true,
      trim: true,
      // Optional: Add more specific validation (e.g., regex for format)
      // validate: {
      //   validator: function(v: string) {
      //     // Example: Basic North American phone format check (adjust as needed)
      //     return /^\+?[1]?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(v);
      //   },
      //   message: props => `${props.value} is not a valid phone number format!`
      // }
    },
    vehicleNumber: {
      type: String,
      required: [true, "Vehicle registration number is required."],
      trim: true,
      uppercase: true, // Often stored in uppercase
    },
    password: {
      type: String,
      required: [true, "Please provide a password for the driver."],
      minlength: [8, "Password must be at least 8 characters long."],
      select: false, // Exclude password from query results by default
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
      index: true, // Index status for potential filtering
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt
    toJSON: { virtuals: true }, // Ensure virtuals are included if needed later
    toObject: { virtuals: true },
  }
);

// --- Indexing ---
// Index unique phone number for faster lookups and uniqueness enforcement
driverSchema.index({ phone: 1 }, { unique: true });

// --- Mongoose Middleware ---

// Hash password before saving a new driver or when password is modified
driverSchema.pre<IDriver>("save", async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified("password")) return next();

  // Hash the password with cost of 12 (adjust cost as needed)
  try {
    this.password = await bcrypt.hash(this.password!, 12); // Non-null assertion ok due to isModified check + required field
    next();
  } catch (error: any) {
    // Pass hashing errors to the error handler
    next(error);
  }
});

// --- Mongoose Instance Methods ---

// Method to compare candidate password with the driver's hashed password
// Note: Need to fetch driver with password field selected (e.g., .select('+password'))
driverSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  // 'this.password' refers to the hashed password on the document instance
  // Need to ensure the document was queried with the password field selected
  if (!this.password) {
    // This should ideally not happen if the password field exists and is selected.
    throw new Error(
      "Password field is missing for comparison. Ensure it was selected in the query."
    );
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

export const Driver: IDriverModel = mongoose.model<IDriver, IDriverModel>(
  "Driver",
  driverSchema
);
