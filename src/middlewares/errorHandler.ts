import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(err);

  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: `Duplicate value for: ${Object.keys(err.keyValue).join(", ")}`,
    });
  }

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};
