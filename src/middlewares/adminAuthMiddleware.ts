// middlewares/adminAuthMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request interface for admin context
declare global {
  namespace Express {
    interface Request {
      adminId?: string; // Add adminId property
      adminRole?: string; // Optional: store role too
    }
  }
}

/**
 * Middleware to protect admin routes by verifying JWT token and admin role.
 * Attaches adminId and adminRole to the request object if the token is valid.
 * Sends a 401/403 response if the token is missing, invalid, expired, or not an admin token.
 */
export const protectAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ success: false, message: "Unauthorized: No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!process.env.JWT_SECRET) {
    console.error(
      "FATAL ERROR: JWT_SECRET is missing from environment variables."
    );
    res
      .status(500)
      .json({
        success: false,
        message: "Internal Server Error: Server configuration missing.",
      });
    return;
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      adminId: string;
      role: string;
      iat: number;
      exp: number;
    }; // Expect admin payload

    // Check if decoded payload has adminId AND the correct role
    if (
      !decoded ||
      typeof decoded.adminId !== "string" ||
      decoded.role !== "admin"
    ) {
      console.warn("Invalid admin token payload or role:", decoded);
      // Use 403 Forbidden if token is valid but role is wrong
      res
        .status(403)
        .json({
          success: false,
          message: "Forbidden: Access restricted to administrators.",
        });
      return;
    }

    // Attach adminId and role to the request object
    req.adminId = decoded.adminId;
    req.adminRole = decoded.role;

    // Token is valid and user is an admin, proceed
    next();
  } catch (error) {
    console.error(
      "Admin JWT Verification Error:",
      error instanceof Error ? error.message : error
    );
    let status = 401;
    let message = "Unauthorized: Token verification failed";

    if (error instanceof jwt.TokenExpiredError) {
      message = "Unauthorized: Token expired";
    } else if (error instanceof jwt.JsonWebTokenError) {
      message = `Unauthorized: ${error.message || "Invalid token"}`;
    }
    res.status(status).json({ success: false, message: message });
    return;
  }
};
