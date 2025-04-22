import { Request, Response } from "express";
import { adminLoginSchema } from "../validators/adminSchema.js";
import { loginAdmin } from "../services/admin.service.js";

export const adminLogin = async (req: Request, res: Response) => {
  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
    }

    const { username, password } = parsed.data;
    const token = await loginAdmin(username, password);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};
