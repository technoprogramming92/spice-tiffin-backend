import { Admin } from "../models/Admin.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const loginAdmin = async (username: string, password: string) => {
  const admin = await Admin.findOne({ username });

  if (!admin) {
    throw new Error("Invalid username or password");
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    throw new Error("Invalid username or password");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET in environment");
  }

  const token = jwt.sign(
    {
      adminId: admin._id,
      role: "admin",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return token;
};
