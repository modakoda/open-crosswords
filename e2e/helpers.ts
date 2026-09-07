import { expect, type Page } from "@playwright/test";
import {
  PUZZLE_URL_PATTERN,
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_CLIENT_EMAIL,
  E2E_CLIENT_PASSWORD,
  E2E_CLIENT2_EMAIL,
  E2E_CLIENT2_PASSWORD,
} from "./constants";

export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.locator("#email").fill(E2E_ADMIN_EMAIL);
  await page.locator("#password").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin\/dashboard/);
}

export async function loginAsClient(page: Page) {
  await page.goto("/client/login");
  await page.locator("#email").fill(E2E_CLIENT_EMAIL);
  await page.locator("#password").fill(E2E_CLIENT_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/client/dashboard");
}

export async function loginAsClient2(page: Page) {
  await page.goto("/client/login");
  await page.locator("#email").fill(E2E_CLIENT2_EMAIL);
  await page.locator("#password").fill(E2E_CLIENT2_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/client/dashboard");
}

/**
 * Submits the generate form, which builds from the site locale (no picker),
 * and returns the new puzzle's slug so a caller can address it afterwards.
 */
export async function generatePuzzleViaUi(page: Page, title?: string) {
  await page.goto("/public");
  if (title) await page.locator("#title").fill(title);
  await page.getByRole("button", { name: /^Generate crossword$/ }).click();
  await page.waitForURL(PUZZLE_URL_PATTERN);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/**
 * Waits for an admin listing's first, unfiltered load to land before a spec
 * types into its search box.
 *
 * The managers issue a fresh request per keystroke and render whichever
 * response arrives last, so a slow initial load can still overwrite a filtered
 * result that came back sooner. Settling first keeps that out of the specs.
 */
export async function waitForListing(page: Page) {
  await expect(page.getByRole("status")).toHaveText(/^Showing /);
}
