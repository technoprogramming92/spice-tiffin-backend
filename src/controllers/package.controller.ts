import { Request, Response } from "express";
import { Package, PackageType } from "../models/Package.model.js";
import {
  createPackageSchema,
  updatePackageSchema,
} from "../validators/packageSchema.js";

const getDaysByType = (type: string): number => {
  switch (type) {
    case PackageType.TRIAL:
      return 1;
    case PackageType.WEEKLY:
      return 6;
    case PackageType.MONTHLY:
      return 24;
    default:
      return 0;
  }
};

export const createPackage = async (req: Request, res: Response) => {
  const parsed = createPackageSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ success: false, error: parsed.error.errors });

  const { name, description, price, type, image } = parsed.data;

  const exists = await Package.findOne({ name });
  if (exists)
    return res
      .status(409)
      .json({ success: false, message: "Package already exists" });

  const days = getDaysByType(type);

  const newPackage = await Package.create({
    name,
    description,
    price,
    type,
    image,
    days,
  });

  res.status(201).json({
    success: true,
    message: "Package created",
    data: newPackage,
  });
};

export const getAllPackages = async (_req: Request, res: Response) => {
  const packages = await Package.find().sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    message: "Packages retrieved",
    packages,
  });
};

export const getSinglePackage = async (req: Request, res: Response) => {
  const pkg = await Package.findById(req.params.id);
  if (!pkg)
    return res
      .status(404)
      .json({ success: false, message: "Package not found" });

  res.status(200).json({ success: true, package: pkg });
};

export const updatePackage = async (req: Request, res: Response) => {
  const parsed = updatePackageSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ success: false, error: parsed.error.errors });

  const updated = await Package.findByIdAndUpdate(
    req.params.id,
    { ...parsed.data, days: getDaysByType(parsed.data.type || "") },
    { new: true }
  );

  if (!updated)
    return res
      .status(404)
      .json({ success: false, message: "Package not found" });

  res
    .status(200)
    .json({ success: true, message: "Package updated", data: updated });
};

export const deletePackage = async (req: Request, res: Response) => {
  const deleted = await Package.findByIdAndDelete(req.params.id);
  if (!deleted)
    return res
      .status(404)
      .json({ success: false, message: "Package not found" });

  res.status(200).json({ success: true, message: "Package deleted" });
};
