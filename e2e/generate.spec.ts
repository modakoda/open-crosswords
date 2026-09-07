import { test, expect } from "./fixtures";
import { PUZZLE_URL_PATTERN } from "./constants";

test("generates a puzzle from the public form and lands on the solve view", async ({ page }) => {
  await page.goto("/public");

  // The picker is there, already assigned the site's language.
  await expect(page.locator("#language")).toHaveText("English");
  await page.locator("#title").fill("E2E Generated Puzzle");
  await page.getByRole("button", { name: /^Generate crossword$/ }).click();

  await page.waitForURL(PUZZLE_URL_PATTERN);
  await expect(page.getByRole("heading", { name: "E2E Generated Puzzle" })).toBeVisible();
  // The grid renders as a set of per-cell labeled inputs — at least one is always present.
  await expect(page.locator('input[aria-label^="Row "]').first()).toBeVisible();
});
