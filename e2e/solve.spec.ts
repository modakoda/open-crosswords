import { test, expect } from "@playwright/test";
import { generatePuzzleViaUi } from "./helpers";

test.describe("solving a puzzle", () => {
  test("typing, checking, revealing, resetting, and the print view all work", async ({ page }) => {
    await generatePuzzleViaUi(page);

    const firstCell = page.locator('input[aria-label^="Row "]').first();
    await firstCell.click();
    // "Z" never appears in any of the e2e word list's answers — a safe, always-wrong guess.
    await page.keyboard.press("Z");
    await expect(firstCell).toHaveValue("Z");

    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("Some letters are wrong or missing.")).toBeVisible();

    await firstCell.click();
    await page.getByRole("button", { name: "Reveal word" }).click();
    await expect(firstCell).not.toHaveValue("");
    await expect(firstCell).not.toHaveValue("Z");

    await page.getByRole("button", { name: "Reset" }).click();
    await page.getByRole("button", { name: "Clear grid" }).click();
    await expect(firstCell).toHaveValue("");

    const printLink = page.getByRole("link", { name: "Print version" });
    const printHref = await printLink.getAttribute("href");
    expect(printHref).toMatch(/\/public\/puzzles\/[A-Za-z0-9_-]{10}\/print$/);

    await page.goto(printHref!);
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to online solver" })).toBeVisible();
  });
});
