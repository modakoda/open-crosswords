import { test, expect } from "./fixtures";
import { ADMIN_STORAGE_STATE } from "./global-setup";
import { E2E_ADMIN_EMAIL, E2E_CLIENT_EMAIL, E2E_CLIENT2_EMAIL } from "./constants";

test.use({ storageState: ADMIN_STORAGE_STATE });

const USERS = "/admin/dashboard/users";

/**
 * The users view. Nothing here deletes an account or revokes a session: the
 * seed's accounts are shared by every other spec in the run, and both actions
 * are covered against a real database in
 * `src/lib/orpc/routers/admin-users.test.ts`. What this proves is the part
 * only the browser can — that the screen lists real accounts, tells an admin
 * apart from a client, and refuses to offer either destructive action against
 * an administrator.
 */
test.describe("admin users view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(USERS);
  });

  const rowFor = (page: import("@playwright/test").Page, email: string) =>
    page.getByRole("row").filter({ hasText: email });

  test("lists accounts and marks who is an administrator", async ({ page }) => {
    await expect(rowFor(page, E2E_CLIENT_EMAIL)).toBeVisible();
    // Exact, or "Admin" also matches the name cell ("E2E Admin") and the
    // address itself — the badge is the only thing under assertion here.
    await expect(
      rowFor(page, E2E_ADMIN_EMAIL).getByText("Admin", { exact: true }),
    ).toBeVisible();
    await expect(
      rowFor(page, E2E_CLIENT_EMAIL).getByText("Client", { exact: true }),
    ).toBeVisible();
  });

  test("searches by email", async ({ page }) => {
    await expect(rowFor(page, E2E_CLIENT_EMAIL)).toBeVisible();
    await page.getByPlaceholder("Search name or email…").fill(E2E_CLIENT2_EMAIL);

    // The summary is the only thing that distinguishes the filtered listing
    // from the stale one — the searched-for row is on screen either way, so
    // asserting it first would race the refetch rather than wait for it.
    await expect(page.getByText("Showing 1–1 of 1")).toBeVisible();
    await expect(rowFor(page, E2E_CLIENT2_EMAIL)).toBeVisible();
    await expect(rowFor(page, E2E_CLIENT_EMAIL)).toHaveCount(0);
  });

  test("offers no destructive action against an admin account", async ({ page }) => {
    await rowFor(page, E2E_ADMIN_EMAIL)
      .getByRole("button", { name: "Row actions" })
      .click();
    // Radix menu items are divs, so unavailability reads as `aria-disabled`.
    await expect(
      page.getByRole("menuitem", { name: "Delete account" }),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(
      page.getByRole("menuitem", { name: "Sign out everywhere" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("offers deletion for a client account", async ({ page }) => {
    await rowFor(page, E2E_CLIENT_EMAIL)
      .getByRole("button", { name: "Row actions" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Delete account" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  test("shows a status for every account", async ({ page }) => {
    await expect(
      rowFor(page, E2E_CLIENT_EMAIL).getByText("Active", { exact: true }),
    ).toBeVisible();
  });

  test("offers no block against an admin account", async ({ page }) => {
    await rowFor(page, E2E_ADMIN_EMAIL)
      .getByRole("button", { name: "Row actions" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Block account…" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  /**
   * The lock is the automatic sign-in backoff, not a block — nobody has one
   * running here, so the action must be unavailable rather than a no-op an
   * admin can click and get nothing from.
   */
  test("offers no lock release for an account that is not locked out", async ({
    page,
  }) => {
    await rowFor(page, E2E_CLIENT_EMAIL)
      .getByRole("button", { name: "Row actions" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Clear sign-in lock" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("filters to blocked accounts, of which the seed has none", async ({ page }) => {
    await expect(rowFor(page, E2E_CLIENT_EMAIL)).toBeVisible();
    await page.getByLabel("Filter by status").click();
    await page.getByRole("option", { name: "Blocked", exact: true }).click();

    await expect(page.getByText("No users yet.")).toBeVisible();
  });

  /**
   * The dialog is where the duration and reason are chosen, so it has to open
   * and it has to be abandonable — dismissing it must leave the account alone.
   * The block itself is covered against a real database in
   * `src/lib/orpc/routers/admin-users.test.ts`; applying one here would leave
   * an account every later spec signs in as blocked.
   */
  test("opens the block dialog and applies nothing when dismissed", async ({
    page,
  }) => {
    await rowFor(page, E2E_CLIENT2_EMAIL)
      .getByRole("button", { name: "Row actions" })
      .click();
    await page.getByRole("menuitem", { name: "Block account…" }).click();

    await expect(page.getByRole("dialog")).toContainText(E2E_CLIENT2_EMAIL);
    await expect(page.getByLabel("Duration")).toBeVisible();
    await expect(page.getByLabel("Reason (optional)")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      rowFor(page, E2E_CLIENT2_EMAIL).getByText("Active", { exact: true }),
    ).toBeVisible();
  });
});
