import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  rootDir: "./src",
  setupFiles: ["<rootDir>/../test-setup/env.test.ts"],
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};

export default config;
