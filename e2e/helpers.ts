import type { Page } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_CLIENT_EMAIL,
  E2E_CLIENT_PASSWORD,
  E2E_CLIENT2_EMAIL,
  E2E_CLIENT2_PASSWORD,
  E2E_LANGUAGE_NAME,
} from "./constants";

/** Radix Select is a combobox trigger + a portal-rendered listbox of options. */
export async function selectRadixOption(page: Page, triggerId: string, optionText: string) {
  await page.locator(`#${triggerId}`).click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.locator("#email").fill(E2E_ADMIN_EMAIL);
  await page.locator("#password").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin/dashboard");
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

/** Fills the generate form for the dedicated e2e content language and submits it. */
export async function generatePuzzleViaUi(page: Page) {
  await page.goto("/public");
  await selectRadixOption(page, "language", E2E_LANGUAGE_NAME);
  await page.getByRole("button", { name: /^Generate crossword$/ }).click();
  await page.waitForURL(/\/public\/puzzles\/[A-Za-z0-9_-]{10}$/);
}
