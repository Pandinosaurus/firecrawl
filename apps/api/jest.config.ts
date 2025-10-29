import type { Config } from "jest";

const config: Config = {
  verbose: true,
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["<rootDir>/dist/"],
  forceExit: true,
  detectOpenHandles: true,
  openHandlesTimeout: 120000,
  watchAll: false,
  // Use custom reporter for organized CI logs when in GitHub Actions
  reporters: process.env.CI
    ? [
        "default",
        "<rootDir>/src/__tests__/reporters/github-actions-reporter.ts",
      ]
    : ["default"],
};

export default config;
