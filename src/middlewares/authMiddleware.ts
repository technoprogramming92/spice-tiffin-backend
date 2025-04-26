// middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request interface to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string; // Add userId property
    }
  }
}

/**
 * Middleware to protect routes by verifying JWT token.
 * Attaches userId to the request object if the token is valid.
 * Sends a 401 response if the token is missing, invalid, or expired.
 */
export const protect = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Explicitly set return type to void
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Send response and explicitly return void
    res
      .status(401)
      .json({ success: false, message: "Unauthorized: No token provided" });
    return; // <-- Add explicit return
  }

  const token = authHeader.split(" ")[1];

  // Ensure JWT_SECRET is configured
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
    return; // <-- Add explicit return
  }

  try {
    // Verify the token using the secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      userId: string;
      iat: number;
      exp: number;
    }; // Type assertion for payload

    // Check if decoded payload has userId (basic validation)
    if (!decoded || typeof decoded.userId !== "string") {
      throw new jwt.JsonWebTokenError("Invalid token payload");
    }

    // Attach userId to the request object for use in subsequent handlers
    req.userId = decoded.userId;

    // Token is valid, proceed to the next middleware or route handler
    next();
  } catch (error) {
    // Handle different JWT errors
    console.error(
      "JWT Verification Error:",
      error instanceof Error ? error.message : error
    );
    let status = 401; // Default to Unauthorized
    let message = "Unauthorized: Token verification failed";

    if (error instanceof jwt.TokenExpiredError) {
      message = "Unauthorized: Token expired";
    } else if (error instanceof jwt.JsonWebTokenError) {
      // Covers invalid signature, malformed token, missing payload etc.
      message = `Unauthorized: ${error.message || "Invalid token"}`;
    }
    // Send the appropriate error response
    res.status(status).json({ success: false, message: message });
    return; // <-- Add explicit return
  }
};
