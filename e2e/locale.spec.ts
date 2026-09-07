import { test, expect } from "./fixtures";
import { E2E_BASE_URL } from "./constants";

/**
 * The site chrome's language is the visitor's explicit choice from the `locale`
 * cookie, falling back to their `Accept-Language`. Playwright runs as `en-US`,
 * so English is the starting point for every test here.
 */
test.describe("UI language", () => {
  test("defaults to the browser's language", async ({ page }) => {
    await page.goto("/public");
    await expect(page.getByRole("heading", { name: "Generate a crossword" })).toBeVisible();
  });

  test("switching translates the chrome and survives a reload", async ({ page }) => {
    await page.goto("/public");
    await page.getByRole("button", { name: /^Language: English$/ }).click();
    await page.getByRole("menuitem", { name: "Lietuvių" }).click();

    await expect(page.getByRole("heading", { name: "Generuoti kryžiažodį" })).toBeVisible();

    // Persisted server-side in the cookie, not in component state.
    const cookie = (await page.context().cookies()).find((c) => c.name === "locale");
    expect(cookie?.value).toBe("lt");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Generuoti kryžiažodį" })).toBeVisible();
  });

  test("an unsupported cookie value falls back rather than breaking the page", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "locale", value: "xx", url: E2E_BASE_URL },
    ]);
    await page.goto("/public");
    await expect(page.getByRole("heading", { name: "Generate a crossword" })).toBeVisible();
  });
});
