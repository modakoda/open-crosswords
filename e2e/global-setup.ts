import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { E2E_BASE_URL } from "./constants";
import { loginAsAdmin, loginAsClient, loginAsClient2 } from "./helpers";

const dirname = path.dirname(fileURLToPath(import.meta.url));
export const ADMIN_STORAGE_STATE = path.join(dirname, ".auth/admin.json");
export const CLIENT_STORAGE_STATE = path.join(dirname, ".auth/client.json");
export const CLIENT2_STORAGE_STATE = path.join(dirname, ".auth/client2.json");

/**
 * Signs in as each fixed e2e account once, up front, and saves the session
 * cookie so individual specs can start already authenticated (`test.use({
 * storageState })`) instead of re-submitting the login form per test. Besides
 * being faster, this avoids tripping better-auth's built-in sign-in rate
 * limiter (on by default in production, stricter for sign-in) under the
 * volume of repeated logins a full suite would otherwise generate.
 */
export default async function globalSetup() {
  const browser = await chromium.launch();
  // One address per sign-in, for the same reason every test gets one (see
  // ./fixtures.ts): sign-in is rate-limited per caller, and an addressless
  // caller shares a bucket with everybody.
  const page = (address: string) =>
    browser.newPage({
      baseURL: E2E_BASE_URL,
      extraHTTPHeaders: { "x-vercel-forwarded-for": address },
    });

  const adminPage = await page("198.51.100.253");
  await loginAsAdmin(adminPage);
  await adminPage.context().storageState({ path: ADMIN_STORAGE_STATE });
  await adminPage.close();

  const clientPage = await page("198.51.100.254");
  await loginAsClient(clientPage);
  await clientPage.context().storageState({ path: CLIENT_STORAGE_STATE });
  await clientPage.close();

  const client2Page = await page("198.51.100.252");
  await loginAsClient2(client2Page);
  await client2Page.context().storageState({ path: CLIENT2_STORAGE_STATE });
  await client2Page.close();

  await browser.close();
}
