import { defineConfig, devices } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_BASE_URL,
  E2E_PORT,
  E2E_UNPROVISIONED_ADMIN_EMAIL,
} from "./e2e/constants";

/**
 * Runs against a real Postgres (see compose.yaml) — PGlite (used by the
 * Vitest integration tests) is in-process only and can't back a separately
 * spawned `next start` server. `e2e/seed.ts` (wired as `pretest:e2e`)
 * provisions the two fixed accounts these tests sign in as.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Specs share one question library and one puzzle listing against a single
  // server, so they run one at a time: a spec that imports, deletes or pages
  // through entries would otherwise see its neighbours' rows. (Rate limiting
  // is no longer a reason — every test carries its own client address, see
  // e2e/fixtures.ts.)
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
      // Two allow-listed addresses, only one of them provisioned. The second
      // is how the suite shows that being on the list is not by itself admin
      // access — see auth-session.spec.ts.
      ADMIN_EMAILS: `${E2E_ADMIN_EMAIL},${E2E_UNPROVISIONED_ADMIN_EMAIL}`,
      NODE_ENV: "production",
      // NODE_ENV=production arms the boot guard in src/lib/env.ts, so the
      // address header has to be stated. Naming one is also what lets each
      // test claim a bucket of its own (e2e/fixtures.ts) instead of the whole
      // run sharing the single bucket an addressless caller falls into.
      AUTH_IP_HEADER: "x-vercel-forwarded-for",
    },
  },
});
