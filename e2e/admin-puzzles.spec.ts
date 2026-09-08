import { test, expect } from "./fixtures";
import { generatePuzzleViaUi, waitForListing } from "./helpers";
import { ADMIN_STORAGE_STATE } from "./global-setup";
import { E2E_UI_LANGUAGE_CODE } from "./constants";

test.use({ storageState: ADMIN_STORAGE_STATE });

/**
 * The library-wide puzzle listing. It is the one view that spans every
 * client's puzzles and shows their owner's email, so it lives behind the admin
 * gate — see the deep-link checks in edge-cases.spec.ts for that half.
 *
 * Scoped to `en` rather than the isolated `zz` language, because the public
 * generate form has no picker and always builds from the site locale. That
 * makes this the one spec that renames and deletes rows in a table it shares
 * with real data, so every mutation here is addressed by the slug of a puzzle
 * this test generated itself — never by position in the listing.
 */
const PUZZLES = `/admin/dashboard/puzzles?lang=${E2E_UI_LANGUAGE_CODE}`;

test("lists a generated puzzle with its owner and finds it by slug", async ({ page }) => {
  const title = `E2E admin puzzle ${Date.now()}`;
  const slug = await generatePuzzleViaUi(page, title);

  await page.goto(PUZZLES);
  await waitForListing(page);
  await page.getByPlaceholder("Search title or link…").fill(slug);

  const row = page.getByRole("row").filter({ hasText: slug });
  await expect(row).toBeVisible();
  await expect(row).toContainText(title);
  // Generated while signed in as the admin, so the puzzle is owned, not anonymous.
  await expect(row).toContainText("e2e-admin@example.com");
  await expect(row.getByRole("link", { name: slug })).toHaveAttribute(
    "href",
    `/public/puzzles/${slug}`,
  );
});

test("renames a puzzle without changing its shared link", async ({ page }) => {
  const title = `E2E rename me ${Date.now()}`;
  const renamed = `${title} (renamed)`;
  const slug = await generatePuzzleViaUi(page, title);

  await page.goto(PUZZLES);
  await waitForListing(page);
  await page.getByPlaceholder("Search title or link…").fill(slug);
  const row = page.getByRole("row").filter({ hasText: slug });
  await row.getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("#puzzle-title")).toHaveValue(title);
  await dialog.locator("#puzzle-title").fill(renamed);
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("row").filter({ hasText: slug })).toContainText(renamed);

  // The slug is server-generated and never re-derived from the title.
  await page.goto(`/public/puzzles/${slug}`);
  await expect(page.getByRole("heading", { name: renamed })).toBeVisible();
});

test("deletes a puzzle, and its public link stops resolving", async ({ page }) => {
  const title = `E2E delete me ${Date.now()}`;
  const slug = await generatePuzzleViaUi(page, title);

  await page.goto(PUZZLES);
  await waitForListing(page);
  await page.getByPlaceholder("Search title or link…").fill(slug);
  const row = page.getByRole("row").filter({ hasText: slug });
  await row.getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(slug);
  await confirm.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("No puzzles match your search")).toBeVisible();

  const response = await page.goto(`/public/puzzles/${slug}`);
  expect(response?.status()).toBe(404);
});

/**
 * Bulk delete, addressed the same careful way as every other mutation here:
 * the listing is narrowed to this test's own stamp and its row count checked
 * before anything is ticked, so select-all can never reach a shared row.
 */
test("bulk-deletes the ticked puzzles, and their links stop resolving", async ({ page }) => {
  const stamp = `${Date.now()}`;
  const slugs = [
    await generatePuzzleViaUi(page, `E2E bulk ${stamp} one`),
    await generatePuzzleViaUi(page, `E2E bulk ${stamp} two`),
  ];

  await page.goto(PUZZLES);
  await waitForListing(page);
  await page.getByPlaceholder("Search title or link…").fill(`E2E bulk ${stamp}`);
  await expect(page.getByRole("row")).toHaveCount(3);

  // No rows ticked yet, so the bar isn't there at all.
  await expect(page.getByText("selected")).toHaveCount(0);

  await page.getByRole("checkbox", { name: "Select all rows" }).click();
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByRole("button", { name: "Delete selected" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.getByText("Delete 2 puzzles?")).toBeVisible();
  await confirm.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("No puzzles match your search")).toBeVisible();
  await expect(page.getByText("2 selected")).toHaveCount(0);

  for (const slug of slugs) {
    const response = await page.goto(`/public/puzzles/${slug}`);
    expect(response?.status()).toBe(404);
  }
});
