import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { call } from "@orpc/server";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const currentUser = { value: { id: "u1", email: "alice@example.com" } };
vi.mock("@/lib/auth-guard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-guard")>("@/lib/auth-guard");
  return {
    ...actual,
    requireUser: vi.fn(async () => {
      if (!currentUser.value) throw new actual.ForbiddenError("Sign-in required");
      return currentUser.value;
    }),
  };
});

const { db } = await import("@/db");
const { entries, languages, puzzles, solveStates, user } = await import("@/db/schema");
const { clientRouter } = await import("./client");
const { generatePuzzle, getPuzzleBySlug, listPuzzlesForUser } = await import("@/lib/puzzles");

const ctx = () => ({ context: { headers: new Headers() } });

async function seedPuzzle() {
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
  return dto;
}

beforeEach(async () => {
  currentUser.value = { id: "u1", email: "alice@example.com" };
  await db.execute(
    sql`truncate ${puzzles}, ${entries}, ${languages}, ${user} restart identity cascade`,
  );
});

describe("client.solveState", () => {
  it("rejects a signed-out caller", async () => {
    const { id: puzzleId } = await seedPuzzle();
    currentUser.value = null as never;
    await expect(
      call(clientRouter.solveState.get, { puzzleId }, ctx()),
    ).rejects.toThrow();
  });

  it("saves and reads back the caller's own progress", async () => {
    const { id: puzzleId } = await seedPuzzle();
    await call(clientRouter.solveState.save, { puzzleId, progress: { "0,0": "P" } }, ctx());
    const { progress } = await call(clientRouter.solveState.get, { puzzleId }, ctx());
    expect(progress).toEqual({ "0,0": "P" });
  });

  it("never returns another user's progress (IDOR)", async () => {
    const { id: puzzleId } = await seedPuzzle();
    await call(clientRouter.solveState.save, { puzzleId, progress: { "0,0": "P" } }, ctx());

    currentUser.value = { id: "u2", email: "bob@example.com" };
    const { progress } = await call(clientRouter.solveState.get, { puzzleId }, ctx());
    expect(progress).toBeNull();
  });

  it("never lets one user overwrite another user's progress (IDOR)", async () => {
    const { id: puzzleId } = await seedPuzzle();
    await call(clientRouter.solveState.save, { puzzleId, progress: { "0,0": "P" } }, ctx());

    currentUser.value = { id: "u2", email: "bob@example.com" };
    await call(clientRouter.solveState.save, { puzzleId, progress: { "0,0": "X" } }, ctx());

    currentUser.value = { id: "u1", email: "alice@example.com" };
    const { progress } = await call(clientRouter.solveState.get, { puzzleId }, ctx());
    expect(progress).toEqual({ "0,0": "P" });
  });
});

describe("client.puzzles.delete", () => {
  it("rejects a signed-out caller", async () => {
    const { slug } = await seedPuzzle();
    currentUser.value = null as never;
    await expect(call(clientRouter.puzzles.delete, { slug }, ctx())).rejects.toThrow();
  });

  it("deletes the caller's own puzzle", async () => {
    const { slug } = await seedPuzzle();
    await expect(call(clientRouter.puzzles.delete, { slug }, ctx())).resolves.toEqual({
      deleted: true,
    });
    expect(await listPuzzlesForUser("u1")).toEqual([]);
  });

  it("takes the caller's saved progress with it", async () => {
    const { id: puzzleId, slug } = await seedPuzzle();
    await call(clientRouter.solveState.save, { puzzleId, progress: { "0,0": "P" } }, ctx());
    await call(clientRouter.puzzles.delete, { slug }, ctx());
    expect(await db.select().from(solveStates)).toEqual([]);
  });

  it("never deletes another user's puzzle (IDOR)", async () => {
    const { slug } = await seedPuzzle();
    currentUser.value = { id: "u2", email: "bob@example.com" };
    await expect(call(clientRouter.puzzles.delete, { slug }, ctx())).rejects.toThrow();
    expect(await listPuzzlesForUser("u1")).toHaveLength(1);
  });

  it("leaves an anonymous puzzle alone", async () => {
    await seedPuzzle();
    const anon = await generatePuzzle(
      { languageCode: "en", paperSize: "a4", orientation: "portrait", seed: "anon" },
      null,
    );
    await expect(
      call(clientRouter.puzzles.delete, { slug: anon.slug }, ctx()),
    ).rejects.toThrow();
    expect(await getPuzzleBySlug(anon.slug)).not.toBeNull();
  });
});
