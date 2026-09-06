import type { Page } from "@playwright/test";
import {
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

/** Submits the generate form, which builds from the site locale (no picker). */
export async function generatePuzzleViaUi(page: Page) {
  await page.goto("/public");
  await page.getByRole("button", { name: /^Generate crossword$/ }).click();
  await page.waitForURL(/\/public\/puzzles\/[A-Za-z0-9_-]{10}$/);
}
