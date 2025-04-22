// Purpose: Script to manually create an admin user in MongoDB

import mongoose from "mongoose";
import "dotenv/config";
import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.model.js";

// Replace these with actual admin details or prompt using inquirer if needed
const ADMIN_DATA = {
  firstName: "Super",
  lastName: "Admin",
  username: "superadmin",
  password: "admin123", // will be hashed
  role: "admin",
};

const createAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI not found in .env");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const existing = await Admin.findOne({ username: ADMIN_DATA.username });
    if (existing) {
      console.log("⚠️ Admin with this username already exists.");
      return process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_DATA.password, 10);

    const newAdmin = new Admin({
      ...ADMIN_DATA,
      password: hashedPassword,
    });

    await newAdmin.save();
    console.log(`🎉 Admin created: ${newAdmin.username}`);
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  }
};

createAdmin();
