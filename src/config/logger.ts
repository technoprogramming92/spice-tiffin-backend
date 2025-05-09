// src/config/logger.ts

import pino from "pino";
import config from "./env"; // Assuming your env config is here (loads .env files)

// Determine transport based on environment

const logger = pino({
  timestamp: pino.stdTimeFunctions.isoTime, // Use ISO time format
});

// Example: ensure LOG_LEVEL is in your env.ts or add it
// In src/config/env.ts, you might have:
// LOG_LEVEL: z.string().default('info'),

export default logger;
