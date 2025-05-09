// src/config/env.ts

/**
 * Loads and validates environment variables using dotenv-flow and Zod.
 * Exports a typed configuration object.
 *
 * How dotenv-flow works:
 * It loads variables from the following files in order, overriding previous values:
 * - .env
 * - .env.local (gitignored, for local overrides)
 * - .env.${NODE_ENV} (e.g., .env.development, .env.production)
 * - .env.${NODE_ENV}.local (gitignored, for local overrides specific to an env)
 */
import dotenvFlow from "dotenv-flow";
import { z } from "zod";
import path from "path"; // For resolving .env file paths if needed

// Configure dotenv-flow. You can specify the path if your .env files are not in the project root.
// By default, it looks in the current working directory (process.cwd()).
dotenvFlow.config({
  // path: path.resolve(__dirname, '../../'), // Example if .env files are in project root and this file is in src/config
  // node_env: process.env.NODE_ENV, // Explicitly set if needed, otherwise it infers
  default_node_env: "development", // Default if NODE_ENV is not set
  // purge_dotenv: true, // Useful to ensure only vars from .env files are loaded, not from shell
});

// Define the schema for your environment variables
const envSchema = z.object({
  // --- General Application ---

  // Base URL of the main frontend application (useful for CORS, redirects, email links)
  FRONTEND_URL: z
    .string()
    .url({ message: "FRONTEND_APP_URL must be a valid URL" })
    .min(1),

  // --- Database ---
  MONGO_URI: z.string().min(1, { message: "MONGODB_URI is required" }),

  // --- Authentication (JWT) ---
  JWT_SECRET: z
    .string()
    .min(32, { message: "JWT_SECRET must be at least 32 characters long" }),

  // --- Payment (Stripe) ---
  STRIPE_SECRET_KEY: z
    .string()
    .startsWith("sk_")
    .min(1, { message: "STRIPE_SECRET_KEY is required" }),

  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").min(1, {
    message: "STRIPE_WEBHOOK_SECRET is required for verifying webhook events",
  }),

  // --- Geocoding (Mapbox) ---
  MAPBOX_ACCESS_TOKEN: z
    .string()
    .min(1, { message: "MAPBOX_API_KEY is required for geocoding" }),
});

// Validate process.env against the schema
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsedEnv.error.format(), null, 2) // Use .format() for readable Zod error output
  );
  // Throwing an error ensures the application stops if the configuration is invalid.
  // This is crucial for preventing runtime errors due to missing/invalid config.
  throw new Error(
    "Invalid environment variables. Check server logs for details."
  );
}

// Export the validated and typed environment variables
const config = parsedEnv.data;

export default config;

// Optional: Export the type for better TypeScript IntelliSense elsewhere
export type AppConfig = z.infer<typeof envSchema>;
