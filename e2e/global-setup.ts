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

  const adminPage = await browser.newPage({ baseURL: E2E_BASE_URL });
  await loginAsAdmin(adminPage);
  await adminPage.context().storageState({ path: ADMIN_STORAGE_STATE });
  await adminPage.close();

  const clientPage = await browser.newPage({ baseURL: E2E_BASE_URL });
  await loginAsClient(clientPage);
  await clientPage.context().storageState({ path: CLIENT_STORAGE_STATE });
  await clientPage.close();

  const client2Page = await browser.newPage({ baseURL: E2E_BASE_URL });
  await loginAsClient2(client2Page);
  await client2Page.context().storageState({ path: CLIENT2_STORAGE_STATE });
  await client2Page.close();

  await browser.close();
}
