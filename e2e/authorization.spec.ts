import { test, expect } from "./fixtures";
import { generatePuzzleViaUi } from "./helpers";
import { CLIENT_STORAGE_STATE, CLIENT2_STORAGE_STATE } from "./global-setup";
import { E2E_BASE_URL } from "./constants";

/**
 * Per-user scoping: solve progress and puzzle ownership. Every one of these
 * rows is reached through an id the server takes from the session, never from
 * the request (`context.user` in a `userProcedure`), so the thing to prove
 * here is that no route in front of that lets a caller name someone else.
 *
 * The admin gate is a separate boundary — see admin-gate.spec.ts.
 */
test("a signed-out visitor cannot read or write server solve state", async ({ page }) => {
  const read = await page.request.post("/rpc/client/solveState/get", {
    data: { json: { puzzleId: "00000000-0000-4000-8000-000000000000" } },
  });
  expect(read.status()).toBe(401);

  const write = await page.request.post("/rpc/client/solveState/save", {
    data: {
      json: { puzzleId: "00000000-0000-4000-8000-000000000000", progress: { "0,0": "X" } },
    },
  });
  expect(write.status()).toBe(401);
});

test("a client can never read or overwrite another client's solve state (IDOR)", async ({
  browser,
  extraHTTPHeaders,
}) => {
  // Contexts built by hand don't inherit the fixture's per-test address
  // (./fixtures.ts), so pass it along rather than dropping these three into the
  // bucket every addressless caller shares.
  const ctx1 = await browser.newContext({
    extraHTTPHeaders,
    storageState: CLIENT_STORAGE_STATE,
    baseURL: E2E_BASE_URL,
  });
  const page1 = await ctx1.newPage();
  await generatePuzzleViaUi(page1);

  const firstCell = page1.locator('input[aria-label^="Row "]').first();
  await firstCell.click();
  const savedRequest = page1.waitForRequest((req) =>
    req.url().includes("/rpc/client/solveState/save"),
  );
  await page1.keyboard.press("Z");
  const saveInput = JSON.parse((await savedRequest).postData()!).json as {
    puzzleId: string;
    progress: Record<string, string>;
  };
  const { puzzleId, progress: client1Progress } = saveInput;
  await ctx1.close();

  const ctx2 = await browser.newContext({
    extraHTTPHeaders,
    storageState: CLIENT2_STORAGE_STATE,
    baseURL: E2E_BASE_URL,
  });
  const page2 = await ctx2.newPage();

  const readAsClient2 = await page2.request.post("/rpc/client/solveState/get", {
    data: { json: { puzzleId } },
  });
  expect((await readAsClient2.json()).json.progress).toBeNull();

  await page2.request.post("/rpc/client/solveState/save", {
    data: { json: { puzzleId, progress: { "0,0": "X" } } },
  });
  await ctx2.close();

  const ctx1b = await browser.newContext({
    extraHTTPHeaders,
    storageState: CLIENT_STORAGE_STATE,
    baseURL: E2E_BASE_URL,
  });
  const page1b = await ctx1b.newPage();
  const readAsClient1Again = await page1b.request.post("/rpc/client/solveState/get", {
    data: { json: { puzzleId } },
  });
  // Client 2's write must never have touched client 1's row.
  expect((await readAsClient1Again.json()).json.progress).toEqual(client1Progress);
  await ctx1b.close();
});

/**
 * Ownership is recorded on the puzzle row (`puzzles.userId`) from the session
 * that generated it, so a dashboard is a per-user view of a shared, publicly
 * addressable table. Two things have to hold at once: one client's puzzle is
 * never listed for another, and a puzzle nobody owns is listed for nobody
 * while staying reachable by its slug.
 */
test("a puzzle is listed only on its own owner's dashboard", async ({
  browser,
  extraHTTPHeaders,
}) => {
  const title = `E2E owned by client one ${Date.now()}`;
  const context = (storageState: string) =>
    browser.newContext({ extraHTTPHeaders, storageState, baseURL: E2E_BASE_URL });

  const ctx1 = await context(CLIENT_STORAGE_STATE);
  const page1 = await ctx1.newPage();
  await generatePuzzleViaUi(page1, title);
  await page1.goto("/client/dashboard");
  await expect(page1.getByText(title)).toBeVisible();
  await ctx1.close();

  const ctx2 = await context(CLIENT2_STORAGE_STATE);
  const page2 = await ctx2.newPage();
  await page2.goto("/client/dashboard");
  await expect(page2.getByText(title)).toHaveCount(0);
  await ctx2.close();
});

test("an anonymously generated puzzle is owned by nobody but stays public", async ({
  browser,
  extraHTTPHeaders,
}) => {
  const title = `E2E owned by nobody ${Date.now()}`;

  const anon = await browser.newContext({ extraHTTPHeaders, baseURL: E2E_BASE_URL });
  const anonPage = await anon.newPage();
  const slug = await generatePuzzleViaUi(anonPage, title);
  await anon.close();

  for (const storageState of [CLIENT_STORAGE_STATE, CLIENT2_STORAGE_STATE]) {
    const ctx = await browser.newContext({ extraHTTPHeaders, storageState, baseURL: E2E_BASE_URL });
    const page = await ctx.newPage();
    await page.goto("/client/dashboard");
    await expect(page.getByText(title)).toHaveCount(0);
    await ctx.close();
  }

  // Unowned is not unreachable — the slug is still the whole access control.
  const visitor = await browser.newContext({ extraHTTPHeaders, baseURL: E2E_BASE_URL });
  const visitorPage = await visitor.newPage();
  const res = await visitorPage.goto(`/public/puzzles/${slug}`);
  expect(res?.status()).toBe(200);
  await expect(visitorPage.getByRole("heading", { name: title })).toBeVisible();
  await visitor.close();
});
