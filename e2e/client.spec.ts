import { test, expect } from "@playwright/test";
import { generatePuzzleViaUi } from "./helpers";
import { CLIENT_STORAGE_STATE } from "./global-setup";
import { E2E_SIGNUP_EMAIL, E2E_SIGNUP_PASSWORD } from "./constants";

test.describe("signed out", () => {
  test("visiting the dashboard redirects to client login", async ({ page }) => {
    await page.goto("/client/dashboard");
    await page.waitForURL("**/client/login");
  });

  test("signs up, lands on the dashboard, and starts with no puzzles", async ({ page }) => {
    await page.goto("/public/sign-up");
    await page.locator("#name").fill("E2E Signup");
    await page.locator("#email").fill(E2E_SIGNUP_EMAIL);
    await page.locator("#password").fill(E2E_SIGNUP_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL("**/client/dashboard");
    await expect(page.getByText("You haven't generated any puzzles yet.")).toBeVisible();
  });
});

test.describe("signed in as the fixed e2e client", () => {
  test.use({ storageState: CLIENT_STORAGE_STATE });

  test("a generated-while-signed-in puzzle appears on the client's own dashboard", async ({
    page,
  }) => {
    await generatePuzzleViaUi(page);

    await page.goto("/client/dashboard");
    await expect(page.getByRole("link", { name: "Continue solving" }).first()).toBeVisible();
  });

  test("solve progress survives clearing local storage (server sync)", async ({ page }) => {
    await generatePuzzleViaUi(page);

    const firstCell = page.locator('input[aria-label^="Row "]').first();
    await firstCell.click();

    const saved = page.waitForResponse((res) =>
      res.url().includes("/rpc/client/solveState/save"),
    );
    await page.keyboard.press("Z");
    await saved;

    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('input[aria-label^="Row "]').first()).toHaveValue("Z");
  });
});
