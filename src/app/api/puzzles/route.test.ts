import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const { db } = await import("@/db");
const { entries, languages, puzzles } = await import("@/db/schema");
const { POST } = await import("./route");
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

function req(body: unknown) {
  return new Request("http://localhost/api/puzzles", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  __resetRateLimits();
  await db.execute(
    sql`truncate ${puzzles}, ${entries}, ${languages} restart identity cascade`,
  );
  await db.insert(languages).values({ code: "en", name: "English" });
});

async function seed() {
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

describe("POST /api/puzzles", () => {
  it("generates a puzzle (201) from enough entries", async () => {
    await seed();
    const res = await POST(req({ languageCode: "en", paperSize: "a4", seed: "fixed-seed" }));
    expect(res.status).toBe(201);
    const { puzzle } = await res.json();
    expect(puzzle.slug).toBeTruthy();
    expect(await db.select().from(puzzles)).toHaveLength(1);
  });

  it("rejects an invalid body with 400", async () => {
    const res = await POST(req({ languageCode: "english", paperSize: "foolscap" }));
    expect(res.status).toBe(400);
  });

  it("returns 422 when the language has too few entries", async () => {
    const res = await POST(req({ languageCode: "en", paperSize: "a4", seed: "fixed-seed" }));
    expect(res.status).toBe(422);
  });

  it("rate-limits after 20 requests in the window", async () => {
    await seed();
    let last = 200;
    for (let i = 0; i < 22; i++) {
      last = (await POST(req({ languageCode: "en", paperSize: "a4", seed: "fixed-seed" }))).status;
    }
    expect(last).toBe(429);
  });
});
