import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { waitForListing } from "./helpers";
import { ADMIN_STORAGE_STATE } from "./global-setup";
import { E2E_LANGUAGE_CODE } from "./constants";

test.use({ storageState: ADMIN_STORAGE_STATE });

const ENTRIES = `/admin/dashboard/entries?lang=${E2E_LANGUAGE_CODE}`;
const IMPORT = `/admin/dashboard/import?lang=${E2E_LANGUAGE_CODE}`;

/** Digits don't survive answer normalization, so a stamp in an answer can't be one. */
const inLetters = (stamp: string) => stamp.replace(/\d/g, (d) => "abcdefghij"[Number(d)]);

/**
 * The listing holds this test's rows and nothing else.
 *
 * Every delete below is confirmed only after this passes. Bulk delete acts on
 * whatever is ticked, so without it a search that quietly failed to narrow
 * would take another spec's rows with it — the bound has to be structural, not
 * a matter of the search having worked.
 */
async function expectOnlyStamped(page: Page, stamp: string, count: number) {
  await expect(page.getByRole("row")).toHaveCount(count + 1);
  await expect(page.getByRole("row").filter({ hasText: stamp })).toHaveCount(count);
}

/** Imports a batch carrying one unique stamp, then narrows the listing to it. */
async function seedStampedEntries(page: Page, stamp: string, count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    clue: `Bulk ${stamp} clue ${i}`,
    answer: `Bulk${inLetters(stamp)}${"abcdefgh"[i]}`,
  }));

  await page.goto(IMPORT);
  await page.locator("textarea").fill(JSON.stringify(rows));
  await page.getByRole("button", { name: "Import" }).click();
  await expect(
    page.getByText(new RegExp(`Inserted ${count}, skipped 0 duplicate`)),
  ).toBeVisible();

  await page.goto(ENTRIES);
  await waitForListing(page);
  await page.getByPlaceholder("Search clue or answer…").fill(`Bulk ${stamp} clue`);
  await expectOnlyStamped(page, stamp, count);
}

/** Ticks every visible row and deletes it, once the listing is known to be ours. */
async function deleteAllVisible(page: Page, stamp: string, count: number) {
  await expectOnlyStamped(page, stamp, count);
  // Clicking select-all when everything is already ticked would clear it, so
  // callers can hand over a listing that is selected or not.
  const selectAll = page.getByRole("checkbox", { name: "Select all rows" });
  if (!(await selectAll.isChecked())) await selectAll.click();
  await expect(page.getByText(`${count} selected`)).toBeVisible();
  await page.getByRole("button", { name: "Delete selected" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No entries match your search")).toBeVisible();
}

test.describe("bulk entry selection", () => {
  test("deletes only the ticked rows", async ({ page }) => {
    const stamp = `${Date.now()}a`;
    await seedStampedEntries(page, stamp, 3);

    // No rows ticked yet, so the bar isn't there at all.
    await expect(page.getByText("selected")).toHaveCount(0);

    await page.getByRole("checkbox", { name: `Select Bulk ${stamp} clue 0` }).click();
    await page.getByRole("checkbox", { name: `Select Bulk ${stamp} clue 2` }).click();
    await expect(page.getByText("2 selected")).toBeVisible();

    await page.getByRole("button", { name: "Delete selected" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Delete 2 entries?")).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    // Exactly the two ticked rows go; the untouched one stays.
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("row").filter({ hasText: `Bulk ${stamp} clue 1` })).toBeVisible();
    await expect(page.getByText("2 selected")).toHaveCount(0);

    await deleteAllVisible(page, stamp, 1);
  });

  test("select-all ticks the whole page and clears after the delete", async ({ page }) => {
    const stamp = `${Date.now()}b`;
    await seedStampedEntries(page, stamp, 3);

    await deleteAllVisible(page, stamp, 3);
    await expect(page.getByText("3 selected")).toHaveCount(0);
  });

  test("cancelling the dialog deletes nothing but keeps the selection", async ({ page }) => {
    const stamp = `${Date.now()}c`;
    await seedStampedEntries(page, stamp, 2);

    await page.getByRole("checkbox", { name: "Select all rows" }).click();
    await page.getByRole("button", { name: "Delete selected" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("row")).toHaveCount(3);
    await expect(page.getByText("2 selected")).toBeVisible();

    await deleteAllVisible(page, stamp, 2);
  });

  /**
   * `useRowSelection` drops the selection whenever the visible ids change, so a
   * bulk delete can never reach a row the admin has scrolled or filtered away.
   */
  test("changing the listing drops the selection", async ({ page }) => {
    const stamp = `${Date.now()}d`;
    await seedStampedEntries(page, stamp, 2);
    const search = page.getByPlaceholder("Search clue or answer…");

    await page.getByRole("checkbox", { name: "Select all rows" }).click();
    await expect(page.getByText("2 selected")).toBeVisible();

    // Narrowing the search changes which rows are visible.
    await search.fill(`Bulk ${stamp} clue 1`);
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByText("selected")).toHaveCount(0);

    await deleteAllVisible(page, stamp, 1);

    await search.fill(`Bulk ${stamp} clue`);
    await deleteAllVisible(page, stamp, 1);
  });
});
