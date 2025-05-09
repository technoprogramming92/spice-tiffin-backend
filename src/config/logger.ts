// src/config/logger.ts

import pino from "pino";
import config from "./env"; // Assuming your env config is here (loads .env files)

// Determine transport based on environment
const transport =
  config.NODE_ENV === "development"
    ? {
        target: "pino-pretty", // Pretty print for development
        options: {
          colorize: true,
          translateTime: "SYS:standard", // Human-readable time format
          ignore: "pid,hostname", // Don't log pid and hostname in dev
          singleLine: false, // Multi-line for readability in dev
        },
      }
    : undefined; // No transport for production, pino logs to stdout by default (JSON)

const logger = pino({
  level:
    config.LOG_LEVEL || (config.NODE_ENV === "development" ? "debug" : "info"),
  ...(transport && { transport }), // Spread transport only if it's defined
  // Base object to include in all logs (optional)
  // base: {
  //   env: config.NODE_ENV,
  //   // service: 'order-service' // if you want to identify service in logs
  // },
  timestamp: pino.stdTimeFunctions.isoTime, // Use ISO time format
});

// Example: ensure LOG_LEVEL is in your env.ts or add it
// In src/config/env.ts, you might have:
// LOG_LEVEL: z.string().default('info'),

export default logger;
