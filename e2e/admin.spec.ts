import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./global-setup";
import { E2E_LANGUAGE_CODE, E2E_LANGUAGE_NAME } from "./constants";

test.use({ storageState: ADMIN_STORAGE_STATE });

test("the header shows the admin link to an admin", async ({ page }) => {
  await page.goto("/public");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Admin" }).first(),
  ).toBeVisible();
});

test.describe("admin dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/dashboard");
    // Scope all admin work to the dedicated e2e language, never the real library.
    await page.getByRole("combobox").first().click();
    await page
      .getByRole("option", { name: `${E2E_LANGUAGE_NAME} (${E2E_LANGUAGE_CODE})` })
      .click();
  });

  test("creates, disables, and deletes an entry", async ({ page }) => {
    const clue = `E2E admin clue ${Date.now()}`;

    await page.getByRole("button", { name: "New entry" }).click();
    await page.locator("#e-clue").fill(clue);
    await page.locator("#e-answer").fill("Testword");
    await page.getByRole("button", { name: "Add entry" }).click();

    const row = page.getByRole("row").filter({ hasText: clue });
    await expect(row).toBeVisible();
    await expect(row.getByText("On")).toBeVisible();

    await row.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Disable" }).click();
    await expect(row.getByText("Off")).toBeVisible();

    await row.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row").filter({ hasText: clue })).toHaveCount(0);
  });

  test("imports entries via bulk import", async ({ page }) => {
    const clue = `E2E import clue ${Date.now()}`;
    await page.getByRole("tab", { name: "Bulk import" }).click();
    await page
      .locator("textarea")
      .fill(JSON.stringify([{ clue, answer: "Imported" }]));
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByText(/Inserted 1, skipped 0 duplicate\(s\), 0 error\(s\)\./)).toBeVisible();

    await page.getByRole("tab", { name: "Entries" }).click();
    await expect(page.getByRole("row").filter({ hasText: clue })).toBeVisible();
  });

  test("pages through the entry listing", async ({ page }) => {
    await page.getByRole("combobox", { name: "Rows per page" }).click();
    await page.getByRole("option", { name: "10 / page" }).click();

    const status = page.getByRole("status");
    await expect(status).toHaveText(/^Showing 1–10 of \d+$/);
    // Header row plus exactly one full page of entries.
    await expect(page.getByRole("row")).toHaveCount(11);
    await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();

    const firstClue = await page.getByRole("row").nth(1).innerText();
    await page.getByRole("button", { name: "Next page" }).click();

    await expect(status).toHaveText(/^Showing 11–\d+ of \d+$/);
    await expect(page.getByRole("row").nth(1)).not.toHaveText(firstClue);
    await expect(page.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });

  test("shows AI drafting as disabled when no API key is configured", async ({ page }) => {
    await page.getByRole("tab", { name: "AI draft" }).click();
    await expect(page.getByText("AI drafting is disabled")).toBeVisible();
  });
});
