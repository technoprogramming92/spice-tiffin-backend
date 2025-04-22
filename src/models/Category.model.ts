// src/models/Category.model.ts
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // packages: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Package",
    //     default: [],
    //   },
    // ],
  },
  { timestamps: true }
);

export const Category = mongoose.model("Category", categorySchema);
