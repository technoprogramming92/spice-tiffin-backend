// models/Category.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ICategory extends Document {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],

      trim: true,
    },
  },
  { timestamps: true }
);

// Add index to enforce uniqueness
categorySchema.index({ name: 1 }, { unique: true });

export const Category = mongoose.model<ICategory>("Category", categorySchema);
