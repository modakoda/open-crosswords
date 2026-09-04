import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const { db } = await import("@/db");
const { languages, entries, puzzles, user, solveStates } = await import("@/db/schema");
const { getSolveState, saveSolveState } = await import("./solve-state");
const { generatePuzzle } = await import("@/lib/puzzles");

async function seedPuzzleAndUsers() {
  await db.insert(languages).values({ code: "en", name: "English" });
  const words = [
    "Paris",
    "Rome",
    "Oslo",
    "Bern",
    "Tokyo",
    "Cairo",
    "Lima",
    "Delhi",
    "Seoul",
    "Accra",
    "Dublin",
    "Vienna",
  ];
  await db.insert(entries).values(
    words.map((answer, i) => ({
      languageCode: "en",
      clue: `Capital ${i}`,
      answer,
      answerNormalized: answer.toUpperCase(),
      length: answer.length,
      difficulty: 3,
      source: "seed",
    })),
  );
  await db.insert(user).values([
    { id: "u1", name: "Alice", email: "alice@example.com" },
    { id: "u2", name: "Bob", email: "bob@example.com" },
  ]);
  const dto = await generatePuzzle(
    { languageCode: "en", paperSize: "a4", orientation: "portrait", seed: "fixed" },
    "u1",
  );
  return dto.id;
}

beforeEach(async () => {
  await db.execute(
    sql`truncate ${solveStates}, ${puzzles}, ${entries}, ${languages}, ${user} restart identity cascade`,
  );
});

describe("saveSolveState / getSolveState", () => {
  it("round-trips a user's own progress", async () => {
    const puzzleId = await seedPuzzleAndUsers();
    await saveSolveState("u1", puzzleId, { "0,0": "P" });
    expect(await getSolveState("u1", puzzleId)).toEqual({ "0,0": "P" });
  });

  it("upserts on repeated saves rather than erroring", async () => {
    const puzzleId = await seedPuzzleAndUsers();
    await saveSolveState("u1", puzzleId, { "0,0": "P" });
    await saveSolveState("u1", puzzleId, { "0,0": "P", "0,1": "A" });
    expect(await getSolveState("u1", puzzleId)).toEqual({ "0,0": "P", "0,1": "A" });
  });

  it("never leaks one user's progress to another (IDOR)", async () => {
    const puzzleId = await seedPuzzleAndUsers();
    await saveSolveState("u1", puzzleId, { "0,0": "P" });
    expect(await getSolveState("u2", puzzleId)).toBeNull();
  });

  it("returns null when no progress has been saved yet", async () => {
    const puzzleId = await seedPuzzleAndUsers();
    expect(await getSolveState("u1", puzzleId)).toBeNull();
  });
});
