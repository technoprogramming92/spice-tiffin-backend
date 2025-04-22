// Purpose: MongoDB connection using Mongoose and environment variables (dotenv-flow)
import mongoose from "mongoose";
import dotenv from "dotenv-flow";

dotenv.config();

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI!);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};
