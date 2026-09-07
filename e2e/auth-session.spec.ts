import { test, expect } from "./fixtures";
import {
  E2E_CLIENT_EMAIL,
  E2E_CLIENT_PASSWORD,
  E2E_UNPROVISIONED_ADMIN_EMAIL,
} from "./constants";

/**
 * Properties of the sign-in and sign-up surfaces themselves, as opposed to
 * what a session then reaches (admin-gate.spec.ts, authorization.spec.ts).
 */

/**
 * The admin check is two things, not one: the address is in ADMIN_EMAILS *and*
 * the account's email is verified (`getAdmin`, src/lib/auth-guard.ts). Only
 * `npm run create-admin` sets the second, so self-serve sign-up cannot grant
 * admin access even for an address that is already on the list — which is what
 * makes public sign-up safe to leave open.
 */
test("signing up as an allow-listed address grants no admin access", async ({ page }) => {
  await page.goto("/public/sign-up");
  await page.locator("#name").fill("E2E Not An Admin");
  await page.locator("#email").fill(E2E_UNPROVISIONED_ADMIN_EMAIL);
  await page.locator("#password").fill("e2e-not-an-admin-password-123");
  await page.getByRole("button", { name: "Create account" }).click();

  // The account is real and signed in — it is only the admin half that fails.
  await page.waitForURL("**/client/dashboard");

  await page.goto("/admin/dashboard");
  await page.waitForURL("**/admin/login");

  const res = await page.request.post("/rpc/admin/entries/list", {
    data: { json: { limit: 20, offset: 0 } },
  });
  expect(res.status()).toBe(403);

  await expect(
    page.getByRole("banner").getByRole("link", { name: "Admin" }),
  ).toHaveCount(0);
});

/**
 * A wrong password on a real account and a password on an account that does not
 * exist have to be indistinguishable, or the form answers "does this address
 * have an account here" for anyone who asks.
 */
test("a failed sign-in never says whether the account exists", async ({ page }) => {
  async function signInError(email: string, password: string) {
    await page.goto("/client/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    return page.getByRole("alert").innerText();
  }

  const unknownAccount = await signInError(
    "e2e-no-such-account@example.com",
    "wrong-password-entirely",
  );
  const wrongPassword = await signInError(E2E_CLIENT_EMAIL, "wrong-password-entirely");

  expect(wrongPassword).toBe(unknownAccount);
  expect(await page.url()).toContain("/client/login");
});

/**
 * The session cookie is the credential. `httpOnly` keeps script off it, and
 * `sameSite: strict` keeps it off cross-site requests — there are no
 * cross-site flows here that would need otherwise.
 */
test("the session cookie is httpOnly and strictly same-site", async ({ page, context }) => {
  await page.goto("/client/login");
  await page.locator("#email").fill(E2E_CLIENT_EMAIL);
  await page.locator("#password").fill(E2E_CLIENT_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/client/dashboard");

  const session = (await context.cookies()).find((c) =>
    c.name.includes("session_token"),
  );
  expect(session, "no session cookie was set").toBeDefined();
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Strict");

  // Nothing in the page can read it, so an injected script cannot lift it.
  const visibleToScript = await page.evaluate(() => document.cookie);
  expect(visibleToScript).not.toContain("session_token");
});
