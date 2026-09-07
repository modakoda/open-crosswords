import { test } from "./fixtures";
import { ADMIN_STORAGE_STATE } from "./global-setup";
import { E2E_LANGUAGE_CODE } from "./constants";

test.use({ storageState: ADMIN_STORAGE_STATE });

test("shot", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/admin/dashboard/languages?lang=${E2E_LANGUAGE_CODE}`);
  await page.getByRole("button", { name: /Rename/ }).first().waitFor();
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-modestas-kazinauskas-dev-open-crosswords/d05348eb-22cb-4cb0-9e53-1a47ff1a6d99/scratchpad/languages-view.png", fullPage: true });
});
