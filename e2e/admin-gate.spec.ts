import { test, expect } from "./fixtures";
import { ADMIN_PROCEDURES, countAdminProceduresInSource } from "./admin-procedures";
import { ADMIN_STORAGE_STATE, CLIENT_STORAGE_STATE } from "./global-setup";
import { ADMIN_VIEWS, E2E_BASE_URL } from "./constants";

/**
 * The admin gate, exercised over HTTP against the running app.
 *
 * `adminProcedure` (src/lib/orpc/middleware.ts) and the route guards are unit-
 * and integration-tested already. What only a real server can show is that
 * nothing in the routing, RSC or session layer in front of them hands a caller
 * a way around: every admin procedure refused, every admin route refused, and
 * the refusal identical whether the caller is a signed-in client or nobody.
 */

test("every admin procedure the routers define is covered here", () => {
  // Fails the day an `adminProcedure` is added without a line in the table —
  // which is exactly when its gate needs an assertion.
  expect(ADMIN_PROCEDURES).toHaveLength(countAdminProceduresInSource());
});

test.describe("a signed-in client is not an admin", () => {
  test.use({ storageState: CLIENT_STORAGE_STATE });

  test("visiting the admin dashboard redirects to admin login, not through", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForURL("**/admin/login");
  });

  // Every view is its own route now, so the gate has to sit on the layout —
  // deep-linking straight to one must not slip past it.
  for (const view of ADMIN_VIEWS) {
    test(`deep-linking to the ${view} view redirects to admin login`, async ({ page }) => {
      await page.goto(`/admin/dashboard/${view}`);
      await page.waitForURL("**/admin/login");
    });
  }

  for (const { path, input } of ADMIN_PROCEDURES) {
    test(`${path} is refused`, async ({ page }) => {
      const res = await page.request.post(`/rpc/${path}`, { data: { json: input } });
      expect(res.status()).toBe(403);
    });
  }

  test("the header offers no admin link, and hiding it is not the control", async ({ page }) => {
    await page.goto("/client/dashboard");
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Admin" }),
    ).toHaveCount(0);
  });
});

/**
 * The admin gate fails closed the same way for a signed-out caller as for a
 * signed-in non-admin: neither is an admin, so neither learns anything from the
 * answer it gets.
 */
test.describe("a signed-out visitor", () => {
  for (const { path, input } of ADMIN_PROCEDURES) {
    test(`${path} is refused`, async ({ page }) => {
      const res = await page.request.post(`/rpc/${path}`, { data: { json: input } });
      expect(res.status()).toBe(403);
    });
  }
});

/**
 * Next decides where to *start* rendering from the client-supplied
 * `Next-Router-State-Tree`. A tree that matches through `dashboard` but names a
 * different leaf makes it skip the layout's render entirely — so the gate in
 * `dashboard/layout.tsx` alone is chrome, not an authorization boundary, and
 * each view page has to re-assert it. Without the page-level `getAdmin` these
 * requests answer 200 with the view's RSC tree.
 */
function skipLayoutProbe(view: string) {
  const sibling = ADMIN_VIEWS.find((v) => v !== view)!;
  const tree = JSON.stringify([
    "",
    {
      children: [
        "admin",
        { children: ["dashboard", { children: [sibling, { children: ["__PAGE__", {}] }] }] },
      ],
    },
    null,
    null,
  ]);
  return {
    url: `/admin/dashboard/${view}?_rsc=probe`,
    headers: { RSC: "1", "Next-Router-State-Tree": encodeURIComponent(tree) },
  };
}

/** Rendered by `dashboard/layout.tsx`, so its absence means the layout was skipped. */
const LAYOUT_HEADING = "Question library";

test.describe("the router state tree cannot skip a view's own gate", () => {
  /**
   * The control for the four probes below. As an admin the same request must
   * come back with the view but *without* the layout's heading — which is what
   * makes those probes meaningful. If Next ever stops honouring the tree, the
   * layout renders, its own guard redirects, and the probes would keep passing
   * while proving nothing. This test fails first instead.
   */
  test("the probe really does skip the layout", async ({ browser, extraHTTPHeaders }) => {
    const context = await browser.newContext({
      extraHTTPHeaders,
      storageState: ADMIN_STORAGE_STATE,
      baseURL: E2E_BASE_URL,
    });
    const probe = skipLayoutProbe("entries");
    const res = await context.request.get(probe.url, { headers: probe.headers });
    const body = await res.text();
    await context.close();

    expect(res.status()).toBe(200);
    expect(body).not.toContain(LAYOUT_HEADING);
    expect(body).not.toContain("NEXT_REDIRECT");
    // The view itself still renders — the response is the leaf, not an error.
    // An RSC payload carries the client component by reference, not its markup.
    expect(body).toContain("EntriesView");
  });

  test.describe("as a signed-in client", () => {
    test.use({ storageState: CLIENT_STORAGE_STATE });

    for (const view of ADMIN_VIEWS) {
      test(`the ${view} view still redirects to admin login`, async ({ page }) => {
        const probe = skipLayoutProbe(view);
        const res = await page.request.get(probe.url, { headers: probe.headers });
        const body = await res.text();
        expect(body).toContain("NEXT_REDIRECT");
        expect(body).toContain("/admin/login");
      });
    }
  });
});
