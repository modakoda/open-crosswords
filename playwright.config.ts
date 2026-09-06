import { defineConfig, devices } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_BASE_URL, E2E_PORT } from "./e2e/constants";

/**
 * Runs against a real Postgres (see compose.yaml) — PGlite (used by the
 * Vitest integration tests) is in-process only and can't back a separately
 * spawned `next start` server. `e2e/seed.ts` (wired as `pretest:e2e`)
 * provisions the two fixed accounts these tests sign in as.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The in-memory rate-limit bucket (src/lib/rate-limit.ts) is keyed by
  // client IP and shared by the whole server process — every test run here
  // shares one browser IP against one server, so tests must run one at a
  // time or the rate-limit edge-case spec would collide with every other
  // spec's own puzzles.generate calls.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "html",
  use: {
    baseURL: E2E_BASE_URL,
    locale: "en-US",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: String(E2E_PORT),
      BETTER_AUTH_URL: E2E_BASE_URL,
      ADMIN_EMAILS: E2E_ADMIN_EMAIL,
      NODE_ENV: "production",
      // NODE_ENV=production arms the boot guard in src/lib/env.ts, so the
      // address header has to be stated. Naming one also lets the rate-limit
      // spec put its burst in a bucket of its own instead of exhausting the
      // one every other spec generates through.
      AUTH_IP_HEADER: "x-vercel-forwarded-for",
    },
  },
});
