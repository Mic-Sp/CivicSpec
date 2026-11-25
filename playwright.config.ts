import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";

loadEnvConfig(process.cwd());
// Isolate test-server sessions/throttle keys from other development app instances.
process.env.CIVICSPEC_BROWSER_AUTH_SECRET ??= randomBytes(48).toString("base64url");

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/auth",
  use: {
    baseURL: "http://127.0.0.1:3196",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3196",
    url: "http://127.0.0.1:3196/api/health",
    reuseExistingServer: false,
    env: { APP_URL: "http://127.0.0.1:3196", AUTH_SECRET: process.env.CIVICSPEC_BROWSER_AUTH_SECRET },
  },
});
