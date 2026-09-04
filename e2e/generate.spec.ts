import { test, expect } from "@playwright/test";
import { selectRadixOption } from "./helpers";
import { E2E_LANGUAGE_NAME } from "./constants";

test("generates a puzzle from the public form and lands on the solve view", async ({ page }) => {
  await page.goto("/public");

  await selectRadixOption(page, "language", E2E_LANGUAGE_NAME);
  await page.locator("#title").fill("E2E Generated Puzzle");
  await page.getByRole("button", { name: /^Generate crossword$/ }).click();

  await page.waitForURL(/\/public\/puzzles\/[A-Za-z0-9_-]{10}$/);
  await expect(page.getByRole("heading", { name: "E2E Generated Puzzle" })).toBeVisible();
  // The grid renders as a set of per-cell labeled inputs — at least one is always present.
  await expect(page.locator('input[aria-label^="Row "]').first()).toBeVisible();
});
