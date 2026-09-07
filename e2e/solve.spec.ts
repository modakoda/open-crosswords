import { test, expect } from "./fixtures";
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
    expect(printHref).toMatch(/\/public\/puzzles\/[a-z]+(-[a-z]+){3}-\d{8}\/print$/);

    await page.goto(printHref!);
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to online solver" })).toBeVisible();
  });

  /**
   * Anonymous solving stays on the device: progress is cached in localStorage
   * and nothing is written to the server, which has no user to scope it to.
   */
  test("anonymous progress persists locally and syncs nothing to the server", async ({
    page,
  }) => {
    const saves: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/rpc/client/solveState/save")) saves.push(req.url());
    });

    await generatePuzzleViaUi(page);
    const firstCell = page.locator('input[aria-label^="Row "]').first();
    await firstCell.click();
    await page.keyboard.press("Z");
    await expect(firstCell).toHaveValue("Z");

    await page.reload();
    await expect(page.locator('input[aria-label^="Row "]').first()).toHaveValue("Z");
    expect(saves).toEqual([]);

    // Clearing the device cache is the only store there was.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('input[aria-label^="Row "]').first()).toHaveValue("");
  });
});
