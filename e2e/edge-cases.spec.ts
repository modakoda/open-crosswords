import { test, expect } from "@playwright/test";
import { generatePuzzleViaUi } from "./helpers";
import { ADMIN_STORAGE_STATE, CLIENT_STORAGE_STATE, CLIENT2_STORAGE_STATE } from "./global-setup";
import { E2E_BASE_URL, E2E_LANGUAGE_CODE } from "./constants";

test("an invalid puzzle slug 404s", async ({ page }) => {
  const response = await page.goto("/public/puzzles/nope1234ab");
  expect(response?.status()).toBe(404);
});

test("puzzle generation is rate-limited after repeated rapid requests", async ({ page }) => {
  // The rate-limit bucket is keyed by client IP (src/lib/rate-limit.ts). A real
  // browser request carries no X-Forwarded-For, so every other test in this
  // suite shares one implicit "local" bucket — deliberately exhausting it here
  // would 429 every later generate call too. Give this burst its own fake IP
  // so it only ever exhausts its own, isolated bucket.
  const headers = { "x-forwarded-for": "203.0.113.5" };
  const statuses: number[] = [];
  for (let i = 0; i < 22; i++) {
    const res = await page.request.post("/rpc/puzzles/generate", {
      headers,
      data: { json: { languageCode: E2E_LANGUAGE_CODE, paperSize: "a4" } },
    });
    statuses.push(res.status());
  }
  expect(statuses).toContain(429);
});

test.describe("admin import validation", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("rejects malformed JSON", async ({ page }) => {
    const res = await page.request.post("/rpc/admin/entries/import", {
      data: {
        json: {
          languageCode: E2E_LANGUAGE_CODE,
          format: "json",
          text: "not valid json",
          createMissingCategories: true,
        },
      },
    });
    expect(res.status()).toBe(422);
  });

  test("rejects a CSV missing required header columns", async ({ page }) => {
    const res = await page.request.post("/rpc/admin/entries/import", {
      data: {
        json: {
          languageCode: E2E_LANGUAGE_CODE,
          format: "csv",
          text: "foo,bar\n1,2",
          createMissingCategories: true,
        },
      },
    });
    expect(res.status()).toBe(422);
  });

  test("rejects an over-length answer field", async ({ page }) => {
    const res = await page.request.post("/rpc/admin/entries/import", {
      data: {
        json: {
          languageCode: E2E_LANGUAGE_CODE,
          format: "json",
          text: JSON.stringify([{ clue: "Too long", answer: "x".repeat(60) }]),
          createMissingCategories: true,
        },
      },
    });
    expect(res.status()).toBe(422);
  });
});

test.describe("a signed-in client is not an admin", () => {
  test.use({ storageState: CLIENT_STORAGE_STATE });

  test("visiting the admin dashboard redirects to admin login, not through", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForURL("**/admin/login");
  });
});

test("a client can never read or overwrite another client's solve state (IDOR)", async ({
  browser,
}) => {
  const ctx1 = await browser.newContext({
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
