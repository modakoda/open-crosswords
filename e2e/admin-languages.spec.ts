import { test, expect } from "./fixtures";
import { ADMIN_STORAGE_STATE } from "./global-setup";
import {
  E2E_ALT_LANGUAGE_CODE,
  E2E_ALT_LANGUAGE_NAME,
  E2E_LANGUAGE_CODE,
  E2E_LANGUAGE_NAME,
} from "./constants";

test.use({ storageState: ADMIN_STORAGE_STATE });

const LANGUAGES = `/admin/dashboard/languages?lang=${E2E_LANGUAGE_CODE}`;

/**
 * The languages view. Adding a language moved here from the dashboard chrome,
 * so this is where that control has to be — and nowhere else.
 *
 * Nothing here creates a language: there is no delete to undo it with, and the
 * seed is deliberately the only thing that writes to the `languages` table.
 * The add form's behaviour is covered by `LanguageManager.test.tsx`.
 */
test.describe("admin languages view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LANGUAGES);
  });

  test("lists the library's languages with what is filed under each", async ({
    page,
  }) => {
    const row = page.getByRole("row").filter({ hasText: E2E_LANGUAGE_NAME });
    await expect(row).toBeVisible();
    await expect(row.getByText(E2E_LANGUAGE_CODE, { exact: true })).toBeVisible();

    // The seed leaves the alt language empty on purpose, which is exactly the
    // case the counts exist to make visible.
    const alt = page.getByRole("row").filter({ hasText: E2E_ALT_LANGUAGE_NAME });
    await expect(alt).toBeVisible();
    await expect(alt.getByRole("cell", { name: "0", exact: true })).toHaveCount(3);
  });

  test("is the only place a language can be added", async ({ page }) => {
    await expect(page.getByLabel("Code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add" })).toBeVisible();

    // The chrome carried this control before; it must not still be there.
    await page.getByRole("link", { name: "Entries" }).click();
    await expect(page.getByText("Add a language")).toHaveCount(0);
  });

  test("renames a language, leaving its code alone", async ({ page }) => {
    const renamed = "E2E Renamed Language";
    const rowFor = (name: string) => page.getByRole("row").filter({ hasText: name });

    const dialog = page.getByRole("dialog", { name: "Rename language" });
    await page.getByRole("button", { name: `Rename ${E2E_ALT_LANGUAGE_NAME}` }).click();
    await dialog.getByLabel("Name", { exact: true }).fill(renamed);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(rowFor(renamed)).toBeVisible();
    await expect(
      rowFor(renamed).getByText(E2E_ALT_LANGUAGE_CODE, { exact: true }),
    ).toBeVisible();
    // The picker elsewhere reads the same list, so it has to have moved too.
    await page.getByRole("link", { name: "Bulk import" }).click();
    await page.getByRole("combobox", { name: "Working language" }).click();
    await expect(
      page.getByRole("option", { name: `${renamed} (${E2E_ALT_LANGUAGE_CODE})` }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Put the seed's name back — the seed inserts with `onConflictDoNothing`,
    // so a rename left behind would outlive this run and break the specs that
    // look the alt language up by name.
    await page.goto(LANGUAGES);
    await page.getByRole("button", { name: `Rename ${renamed}` }).click();
    await dialog.getByLabel("Name", { exact: true }).fill(E2E_ALT_LANGUAGE_NAME);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(rowFor(E2E_ALT_LANGUAGE_NAME)).toBeVisible();
  });
});
