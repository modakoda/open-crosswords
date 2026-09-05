import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const { db } = await import("@/db");
const { entries, languages, puzzles, user } = await import("@/db/schema");
const {
  generatePuzzle,
  getPuzzleBySlug,
  listPuzzlesForUser,
  fetchCandidatePool,
  NotEnoughEntriesError,
} = await import("@/lib/puzzles");

const WORDS = [
  ["Capital of France", "Paris"],
  ["Frozen water", "Ice"],
  ["King of the jungle", "Lion"],
  ["Red planet", "Mars"],
  ["Study of living things", "Biology"],
  ["Sport at Wimbledon", "Tennis"],
  ["Yellow citrus fruit", "Lemon"],
  ["Large grey mammal with a trunk", "Elephant"],
  ["Opposite of night", "Day"],
  ["Frozen dessert", "Sorbet"],
  ["Woodwind instrument", "Oboe"],
  ["Nocturnal hooting bird", "Owl"],
];

async function seedEntries(difficulty = 3) {
  await db.insert(languages).values({ code: "en", name: "English" });
  await db.insert(entries).values(
    WORDS.map(([clue, answer]) => ({
      languageCode: "en",
      clue,
      answer,
      answerNormalized: answer.toUpperCase(),
      length: answer.length,
      difficulty,
      source: "seed",
    })),
  );
}

/** Adds a handful of hard-only answers on top of an existing seed. */
async function seedHardEntries() {
  await db.insert(entries).values(
    [
      ["Obscure Welsh valley", "Cwmtwrch"],
      ["Rare earth metal", "Ytterbium"],
      ["Old-fashioned quill holder", "Escritoire"],
      ["Nine-sided figure", "Nonagon"],
    ].map(([clue, answer]) => ({
      languageCode: "en",
      clue,
      answer,
      answerNormalized: answer.toUpperCase(),
      length: answer.length,
      difficulty: 5,
      source: "seed",
    })),
  );
}

beforeEach(async () => {
  await db.execute(
    sql`truncate ${puzzles}, ${entries}, ${languages}, ${user} restart identity cascade`,
  );
});

describe("generatePuzzle", () => {
  it("builds, persists, and returns a solvable puzzle", async () => {
    await seedEntries();
    const dto = await generatePuzzle({
      languageCode: "en",
      paperSize: "a4",
      orientation: "portrait",
      seed: "fixed-seed",
    });

    expect(dto.slug).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(dto.clues.across.length + dto.clues.down.length).toBeGreaterThanOrEqual(4);
    expect(dto.width).toBeLessThanOrEqual(23);

    // every clue's answer sits in the grid at its start cell
    for (const c of [...dto.clues.across, ...dto.clues.down]) {
      expect(dto.grid[c.row][c.col]?.solution).toBe(c.answer[0]);
    }

    const fromDb = await getPuzzleBySlug(dto.slug);
    expect(fromDb?.title).toBe(dto.title);
  });

  it("marks the entries it used (timesUsed / lastUsedAt)", async () => {
    await seedEntries();
    const dto = await generatePuzzle({
      languageCode: "en",
      paperSize: "a4",
      orientation: "portrait",
      seed: "s",
    });
    const rows = await db.select().from(entries);
    const used = rows.filter((r) => r.timesUsed > 0);
    expect(used.length).toBe(dto.clues.across.length + dto.clues.down.length);
    expect(used.every((r) => r.lastUsedAt instanceof Date)).toBe(true);
  });

  it("persists the seed and honours an explicit one", async () => {
    await seedEntries();
    const dto = await generatePuzzle({
      languageCode: "en",
      paperSize: "a4",
      orientation: "portrait",
      seed: "my-seed",
    });
    const [row] = await db.select().from(puzzles);
    expect(row.seed).toBe("my-seed");
    expect(row.slug).toBe(dto.slug);
  });

  it("attaches the generating user's id when signed in", async () => {
    await seedEntries();
    await db.insert(user).values({ id: "u1", name: "Alice", email: "alice@example.com" });
    await generatePuzzle(
      { languageCode: "en", paperSize: "a4", orientation: "portrait", seed: "s1" },
      "u1",
    );
    const [row] = await db.select().from(puzzles);
    expect(row.userId).toBe("u1");
  });

  it("leaves userId null for anonymous generation", async () => {
    await seedEntries();
    await generatePuzzle({ languageCode: "en", paperSize: "a4", orientation: "portrait", seed: "s2" });
    const [row] = await db.select().from(puzzles);
    expect(row.userId).toBeNull();
  });

  it("only draws clues inside the requested difficulty band", async () => {
    await seedEntries(1);
    await seedHardEntries();

    const dto = await generatePuzzle({
      languageCode: "en",
      paperSize: "a4",
      orientation: "portrait",
      difficulty: "easy",
      seed: "diff-easy",
    });

    const easyAnswers = new Set(WORDS.map(([, a]) => a.toUpperCase()));
    for (const c of [...dto.clues.across, ...dto.clues.down]) {
      expect(easyAnswers.has(c.answer)).toBe(true);
    }
  });

  it("rejects when no entry matches the requested difficulty", async () => {
    await seedEntries(1);
    await expect(
      generatePuzzle({
        languageCode: "en",
        paperSize: "a4",
        orientation: "portrait",
        difficulty: "hard",
      }),
    ).rejects.toBeInstanceOf(NotEnoughEntriesError);
  });

  it("rejects when there are too few entries", async () => {
    await db.insert(languages).values({ code: "en", name: "English" });
    await db.insert(entries).values({
      languageCode: "en",
      clue: "Only one",
      answer: "Solo",
      answerNormalized: "SOLO",
      length: 4,
      difficulty: 3,
      source: "seed",
    });
    await expect(
      generatePuzzle({ languageCode: "en", paperSize: "a4", orientation: "portrait" }),
    ).rejects.toBeInstanceOf(NotEnoughEntriesError);
  });
});

describe("fetchCandidatePool", () => {
  it("samples randomly, so a pool bigger than the limit isn't stuck on one fixed subset", async () => {
    await db.insert(languages).values({ code: "en", name: "English" });
    await db.insert(entries).values(
      Array.from({ length: 50 }, (_, i) => ({
        languageCode: "en",
        clue: `Clue ${i}`,
        answer: `Answer${i}`,
        answerNormalized: `ANSWER${i}`,
        length: 7,
        difficulty: 3,
        source: "seed",
      })),
    );

    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const rows = await fetchCandidatePool("en", undefined, undefined, 10);
      expect(rows.length).toBe(10);
      for (const r of rows) seen.add(r.id);
    }
    // A stable (non-random) order would return the same 10 rows every time.
    expect(seen.size).toBeGreaterThan(10);
  });
});

describe("fetchCandidatePool difficulty filter", () => {
  it("returns only entries inside the band, and everything for \"any\"", async () => {
    await seedEntries(1);
    await seedHardEntries();

    const easy = await fetchCandidatePool("en", undefined, "easy");
    expect(easy.length).toBe(WORDS.length);
    expect(easy.every((c) => c.difficulty <= 2)).toBe(true);

    const hard = await fetchCandidatePool("en", undefined, "hard");
    expect(hard.every((c) => c.difficulty >= 4)).toBe(true);
    expect(hard.length).toBe(4);

    const any = await fetchCandidatePool("en", undefined, "any");
    expect(any.length).toBe(WORDS.length + 4);
  });
});

describe("listPuzzlesForUser", () => {
  it("only returns the given user's own puzzles, never another user's", async () => {
    await seedEntries();
    await db.insert(user).values([
      { id: "u1", name: "Alice", email: "alice@example.com" },
      { id: "u2", name: "Bob", email: "bob@example.com" },
    ]);
    await generatePuzzle(
      { languageCode: "en", paperSize: "a4", orientation: "portrait", seed: "a" },
      "u1",
    );
    await generatePuzzle(
      { languageCode: "en", paperSize: "a4", orientation: "portrait", seed: "b" },
      "u2",
    );

    const alicesPuzzles = await listPuzzlesForUser("u1");
    expect(alicesPuzzles).toHaveLength(1);
    expect(alicesPuzzles[0].title).toBeTruthy();

    const bobsPuzzles = await listPuzzlesForUser("u2");
    expect(bobsPuzzles).toHaveLength(1);
    expect(alicesPuzzles[0]).not.toEqual(bobsPuzzles[0]);
  });

  it("returns an empty list for a user with no puzzles", async () => {
    await db.insert(user).values({ id: "u3", name: "Carol", email: "carol@example.com" });
    expect(await listPuzzlesForUser("u3")).toEqual([]);
  });
});

describe("getPuzzleBySlug", () => {
  it("returns null for an unknown slug", async () => {
    expect(await getPuzzleBySlug("nope1234ab")).toBeNull();
  });
});
