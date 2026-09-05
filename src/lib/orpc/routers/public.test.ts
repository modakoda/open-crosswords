import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { call } from "@orpc/server";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const currentUser = { value: null as { id: string; email: string } | null };
vi.mock("@/lib/auth-guard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-guard")>("@/lib/auth-guard");
  return { ...actual, getCurrentUser: vi.fn(async () => currentUser.value) };
});

const { db } = await import("@/db");
const { entries, languages, puzzles, user } = await import("@/db/schema");
const { publicRouter } = await import("./public");
const { __resetRateLimits } = await import("@/lib/rate-limit");

const WORDS = [
  ["City on the Seine", "Paris"],
  ["Capital of Greece", "Athens"],
  ["Capital of Spain", "Madrid"],
  ["Flows to the sea", "River"],
  ["Sandy wasteland", "Desert"],
  ["Gas we breathe", "Oxygen"],
  ["Element number 6", "Carbon"],
  ["Six-string instrument", "Guitar"],
  ["Bowed string instrument", "Violin"],
  ["Keyboard instrument", "Piano"],
];

function ctx(ip = "10.0.0.1") {
  return { context: { headers: new Headers({ "x-forwarded-for": ip }) } };
}

async function seed() {
  await db.insert(languages).values({ code: "en", name: "English" });
  await db.insert(entries).values(
    WORDS.map(([clue, answer]) => ({
      languageCode: "en",
      clue,
      answer,
      answerNormalized: answer.toUpperCase(),
      length: answer.length,
      difficulty: 3,
      source: "seed",
    })),
  );
}

beforeEach(async () => {
  __resetRateLimits();
  currentUser.value = null;
  await db.execute(
    sql`truncate ${puzzles}, ${entries}, ${languages}, ${user} restart identity cascade`,
  );
});

describe("puzzles.generate", () => {
  it("generates a puzzle from enough entries", async () => {
    await seed();
    const { puzzle } = await call(
      publicRouter.puzzles.generate,
      { languageCode: "en", paperSize: "a4", seed: "fixed-seed" },
      ctx(),
    );
    expect(puzzle.slug).toBeTruthy();
    expect(await db.select().from(puzzles)).toHaveLength(1);
  });

  it("rejects an invalid body", async () => {
    await expect(
      call(
        publicRouter.puzzles.generate,
        { languageCode: "english", paperSize: "foolscap" as never },
        ctx(),
      ),
    ).rejects.toThrow();
  });

  it("rejects when the language has too few entries", async () => {
    await expect(
      call(
        publicRouter.puzzles.generate,
        { languageCode: "en", paperSize: "a4", seed: "fixed-seed" },
        ctx(),
      ),
    ).rejects.toThrow();
  });

  it("tags a too-few-entries failure with a machine-readable reason", async () => {
    await expect(
      call(
        publicRouter.puzzles.generate,
        { languageCode: "en", paperSize: "a4", seed: "fixed-seed" },
        ctx(),
      ),
    ).rejects.toMatchObject({
      code: "UNPROCESSABLE_CONTENT",
      data: { reason: "no-entries" },
    });
  });

  it("rate-limits after 20 requests in the window", async () => {
    await seed();
    let lastError: unknown;
    for (let i = 0; i < 22; i++) {
      try {
        await call(
          publicRouter.puzzles.generate,
          { languageCode: "en", paperSize: "a4", seed: "fixed-seed" },
          ctx(),
        );
      } catch (err) {
        lastError = err;
      }
    }
    expect(lastError).toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("attaches the signed-in user's id, leaves anonymous requests unowned", async () => {
    await seed();
    await db.insert(user).values({ id: "u1", name: "Alice", email: "alice@example.com" });
    currentUser.value = { id: "u1", email: "alice@example.com" };
    await call(
      publicRouter.puzzles.generate,
      { languageCode: "en", paperSize: "a4", seed: "signed-in" },
      ctx("10.0.0.2"),
    );
    const [row] = await db.select().from(puzzles);
    expect(row.userId).toBe("u1");
  });
});

describe("puzzles.getBySlug", () => {
  it("404s for an unknown slug", async () => {
    await expect(
      call(publicRouter.puzzles.getBySlug, { slug: "nope1234ab" }, ctx()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
