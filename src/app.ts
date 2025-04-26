// Purpose: Configure Express app with middleware and routing
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import pino from "pino-http";
import errorHandler from "./middlewares/errorHandler.js";
import healthRoutes from "./routes/health.route.js";
import authRoutes from "./routes/auth.route.js";
import adminRoutes from "./routes/admin.route.js";
import categoryRoutes from "./routes/category.routes.js";
import packageRoutes from "./routes/package.routes.js";
import customerRoutes from "./routes/customer.route.js";
import paymentRoutes from "./routes/payment.route.js";
import orderRoutes from "./routes/order.route.js";
import webhookRoutes from "./routes/webhook.route.js";

const app = express();
app.disable("etag");

// Global Middleware
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(morgan("dev")); // Switch to pino in production
app.use(pino());

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/packages", packageRoutes);
app.use("/api/v1/customer", customerRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/webhooks/stripe", express.raw({ type: "application/json" }));
app.use("/api/v1/webhooks", webhookRoutes);

// Global Error Handler
app.use(errorHandler as any);

export default app;
