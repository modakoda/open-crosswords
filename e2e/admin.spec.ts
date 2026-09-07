import { test, expect } from "./fixtures";
import { ADMIN_STORAGE_STATE } from "./global-setup";
import {
  E2E_ALT_LANGUAGE_CODE,
  E2E_ALT_LANGUAGE_NAME,
  E2E_LANGUAGE_CODE,
  E2E_LANGUAGE_NAME,
} from "./constants";

test.use({ storageState: ADMIN_STORAGE_STATE });

/** Scope all admin work to the dedicated e2e language, never the real library. */
const ENTRIES = `/admin/dashboard/entries?lang=${E2E_LANGUAGE_CODE}`;

test("the header shows the admin link to an admin", async ({ page }) => {
  await page.goto("/public");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Admin" }).first(),
  ).toBeVisible();
});

test.describe("admin view routing", () => {
  test("the dashboard root redirects to the entries view", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForURL(/\/admin\/dashboard\/entries/);
    await expect(page.getByRole("button", { name: "New entry" })).toBeVisible();
  });

  test("every view is reachable by its own URL", async ({ page }) => {
    await page.goto(`/admin/dashboard/puzzles?lang=${E2E_LANGUAGE_CODE}`);
    await expect(page.getByPlaceholder("Search title or link…")).toBeVisible();

    await page.goto(`/admin/dashboard/import?lang=${E2E_LANGUAGE_CODE}`);
    await expect(page.getByLabel("Choose a JSON or CSV file")).toBeVisible();

    await page.goto(`/admin/dashboard/ai?lang=${E2E_LANGUAGE_CODE}`);
    await expect(page.getByText("AI drafting is disabled")).toBeVisible();
  });

  test("navigating changes the URL and the back button returns", async ({ page }) => {
    await page.goto(ENTRIES);
    await page.getByRole("link", { name: "Puzzles" }).click();

    // The working language rides along, so the linked view stays scoped.
    await expect(page).toHaveURL(
      `/admin/dashboard/puzzles?lang=${E2E_LANGUAGE_CODE}`,
    );
    await expect(page.getByPlaceholder("Search title or link…")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(ENTRIES);
    await expect(page.getByRole("button", { name: "New entry" })).toBeVisible();
  });

  test("the working language is written to the URL and survives a reload", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard/entries");
    // The listing's own filter is the working-language control on this view.
    await page.getByRole("combobox", { name: "Filter by language" }).click();
    await page
      .getByRole("option", { name: `${E2E_LANGUAGE_NAME} (${E2E_LANGUAGE_CODE})` })
      .click();

    await expect(page).toHaveURL(new RegExp(`lang=${E2E_LANGUAGE_CODE}`));

    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Filter by language" }),
    ).toHaveText(`${E2E_LANGUAGE_NAME} (${E2E_LANGUAGE_CODE})`);
  });

  test("only the views without a language filter carry the working-language picker", async ({
    page,
  }) => {
    const picker = page.getByRole("combobox", { name: "Working language" });

    for (const view of ["entries", "puzzles"]) {
      await page.goto(`/admin/dashboard/${view}?lang=${E2E_LANGUAGE_CODE}`);
      await expect(
        page.getByRole("combobox", { name: "Filter by language" }),
      ).toBeVisible();
      await expect(picker).toHaveCount(0);
    }

    for (const view of ["import", "ai"]) {
      await page.goto(`/admin/dashboard/${view}?lang=${E2E_LANGUAGE_CODE}`);
      await expect(picker).toHaveText(
        `${E2E_LANGUAGE_NAME} (${E2E_LANGUAGE_CODE})`,
      );
    }
  });
});

test.describe("admin dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENTRIES);
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

  test("edits an entry's clue, answer, difficulty and category", async ({ page }) => {
    const clue = `E2E edit clue ${Date.now()}`;
    const edited = `${clue} (edited)`;
    const categoryName = `E2E cat ${Date.now()}`;

    await page.getByRole("button", { name: "New entry" }).click();
    await page.locator("#e-clue").fill(clue);
    await page.locator("#e-answer").fill("Beforeword");
    await page.getByRole("button", { name: "Add entry" }).click();
    const row = page.getByRole("row").filter({ hasText: clue });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    // The dialog opens on the row's own values, not a blank form.
    await expect(page.locator("#e-clue")).toHaveValue(clue);
    await expect(page.locator("#e-answer")).toHaveValue("Beforeword");

    await page.locator("#e-clue").fill(edited);
    await page.locator("#e-answer").fill("Afterword");
    await page.locator("#e-cat").fill(categoryName);
    await page.getByRole("combobox", { name: "Difficulty" }).click();
    await page.getByRole("option", { name: "Difficulty 5" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();

    const updated = page.getByRole("row").filter({ hasText: edited });
    await expect(updated).toBeVisible();
    await expect(updated.getByText("AFTERWORD")).toBeVisible();
    await expect(updated.getByText(categoryName)).toBeVisible();
    await expect(updated.getByText("5", { exact: true })).toBeVisible();

    // The edit persists — it's a row change, not just local state.
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: edited })).toBeVisible();

    const cleanup = page.getByRole("row").filter({ hasText: edited });
    await cleanup.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row").filter({ hasText: edited })).toHaveCount(0);
  });

  test("moves an entry to another language", async ({ page }) => {
    const clue = `E2E move clue ${Date.now()}`;

    await page.getByRole("button", { name: "New entry" }).click();
    await page.locator("#e-clue").fill(clue);
    await page.locator("#e-answer").fill("Movable");
    await page.getByRole("button", { name: "Add entry" }).click();
    const row = page.getByRole("row").filter({ hasText: clue });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByRole("combobox", { name: "Language" }).click();
    await page
      .getByRole("option", { name: `${E2E_ALT_LANGUAGE_NAME} (${E2E_ALT_LANGUAGE_CODE})` })
      .click();
    await page.getByRole("button", { name: "Save changes" }).click();

    // Gone from the language it left, present in the one it moved to.
    await expect(page.getByRole("row").filter({ hasText: clue })).toHaveCount(0);
    await page.goto(`/admin/dashboard/entries?lang=${E2E_ALT_LANGUAGE_CODE}`);
    const moved = page.getByRole("row").filter({ hasText: clue });
    await expect(moved).toBeVisible();

    await moved.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row").filter({ hasText: clue })).toHaveCount(0);
  });

  test("imports entries via bulk import", async ({ page }) => {
    const clue = `E2E import clue ${Date.now()}`;
    await page.getByRole("link", { name: "Bulk import" }).click();
    await page
      .locator("textarea")
      .fill(JSON.stringify([{ clue, answer: "Imported" }]));
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByText(/Inserted 1, skipped 0 duplicate\(s\), 0 error\(s\)\./)).toBeVisible();

    await page.getByRole("link", { name: "Entries" }).click();
    await expect(page.getByRole("row").filter({ hasText: clue })).toBeVisible();
  });

  test("imports entries from a chosen JSON file", async ({ page }) => {
    const clue = `E2E file import clue ${Date.now()}`;
    await page.getByRole("link", { name: "Bulk import" }).click();

    await page.getByLabel("Choose a JSON or CSV file").setInputFiles({
      name: "entries.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify([{ clue, answer: "Filed" }])),
    });

    await expect(page.getByText("entries.json")).toBeVisible();
    await expect(page.locator("textarea")).toHaveValue(new RegExp(clue));

    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByText(/Inserted 1, skipped 0 duplicate\(s\), 0 error\(s\)\./)).toBeVisible();

    await page.getByRole("link", { name: "Entries" }).click();
    await expect(page.getByRole("row").filter({ hasText: clue })).toBeVisible();
  });

  test("imports a large JSON file in batches", async ({ page }) => {
    const stamp = Date.now();
    const rows = Array.from({ length: 600 }, (_, i) => ({
      clue: `E2E batch clue ${stamp} number ${i}`,
      answer: `Batched${i}`,
    }));

    await page.getByRole("link", { name: "Bulk import" }).click();
    await page.getByLabel("Choose a JSON or CSV file").setInputFiles({
      name: "big.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(rows)),
    });

    // 600 rows exceeds the 500-row chunk cap, so this goes out as two requests.
    await page.getByRole("button", { name: "Import" }).click();
    await expect(
      page.getByText(/Inserted 600, skipped 0 duplicate\(s\), 0 error\(s\)\./),
    ).toBeVisible({ timeout: 60_000 });
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
    await page.getByRole("link", { name: "AI draft" }).click();
    await expect(page.getByText("AI drafting is disabled")).toBeVisible();
  });
});
