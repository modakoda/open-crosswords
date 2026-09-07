import { test, expect } from "./fixtures";
import { ADMIN_STORAGE_STATE } from "./global-setup";
import { E2E_LANGUAGE_CODE } from "./constants";

test("an invalid puzzle slug 404s", async ({ page }) => {
  const response = await page.goto("/public/puzzles/nope1234ab");
  expect(response?.status()).toBe(404);
});

// A slug is the only thing guarding a puzzle, so a well-formed guess must be
// as dead an end as a malformed one — no redirect, no partial render.
test("a well-formed but unknown puzzle slug 404s too", async ({ page }) => {
  const response = await page.goto("/public/puzzles/amber-quiet-otter-canyon-48392174");
  expect(response?.status()).toBe(404);
  expect(new URL(page.url()).pathname).toBe(
    "/public/puzzles/amber-quiet-otter-canyon-48392174",
  );
});

test("puzzle generation is rate-limited after repeated rapid requests", async ({ page }) => {
  // The rate-limit bucket is keyed by the one address header the deployment
  // trusts (src/lib/client-ip.ts, AUTH_IP_HEADER). Every test already carries
  // one of its own (see ./fixtures.ts); this burst states its address per
  // request so exhausting a bucket stays this test's business either way.
  const headers = { "x-vercel-forwarded-for": "203.0.113.5" };
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

/**
 * The limiter reads exactly one header (`src/lib/client-ip.ts`), never a union
 * of candidates. That is the whole defence: a second header the app is willing
 * to believe is one a caller can rotate to walk out of a bucket, or pin to
 * someone else's address to burn theirs. So a burst that holds the trusted
 * header fixed and varies `x-forwarded-for` on every request must still be
 * counted as one caller.
 */
test("a rotating x-forwarded-for cannot escape the rate limit", async ({ page }) => {
  const statuses: number[] = [];
  for (let i = 0; i < 22; i++) {
    const res = await page.request.post("/rpc/puzzles/generate", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.6",
        "x-forwarded-for": `203.0.113.${100 + i}`,
      },
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
