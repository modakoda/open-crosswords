import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const { db } = await import("@/db");
const { entries, languages } = await import("@/db/schema");
const { renormalizeEntries } = await import("./renormalize");

/**
 * Insert a row the way the old rules would have written it — the situation the
 * pass exists for — rather than going through `createEntry`, which already
 * applies the new ones.
 */
async function seed(row: {
  languageCode: string;
  clue: string;
  answer: string;
  answerNormalized: string;
}) {
  const [inserted] = await db
    .insert(entries)
    .values({ ...row, length: row.answerNormalized.length })
    .returning({ id: entries.id });
  return inserted.id;
}

beforeEach(async () => {
  await db.execute(sql`truncate ${entries}, ${languages} restart identity cascade`);
  await db.insert(languages).values([
    { code: "lt", name: "Lietuvių" },
    { code: "en", name: "English" },
  ]);
});

describe("renormalizeEntries", () => {
  it("rewrites rows the rules now normalize differently", async () => {
    const id = await seed({
      languageCode: "lt",
      clue: "Plaukioja vandenyje",
      answer: "žuvis",
      answerNormalized: "ZUVIS",
    });

    const result = await renormalizeEntries();

    expect(result).toMatchObject({ scanned: 1, updated: 1, skipped: [] });
    const [row] = await db.select().from(entries);
    expect(row.id).toBe(id);
    expect(row.answerNormalized).toBe("ŽUVIS");
    expect(row.length).toBe(5);
  });

  it("leaves rows that already agree, and is safe to re-run", async () => {
    await seed({
      languageCode: "en",
      clue: "Capital of France",
      answer: "Paris",
      answerNormalized: "PARIS",
    });
    await seed({
      languageCode: "lt",
      clue: "Plaukioja vandenyje",
      answer: "žuvis",
      answerNormalized: "ZUVIS",
    });

    expect((await renormalizeEntries()).updated).toBe(1);
    expect(await renormalizeEntries()).toMatchObject({ scanned: 2, updated: 0, skipped: [] });
  });

  it("only touches the language it is scoped to", async () => {
    await seed({
      languageCode: "lt",
      clue: "Plaukioja vandenyje",
      answer: "žuvis",
      answerNormalized: "ZUVIS",
    });
    // Same answer filed under English, where Ž is not a letter of its own.
    const en = await seed({
      languageCode: "en",
      clue: "Plaukioja vandenyje",
      answer: "žuvis",
      answerNormalized: "ZUVIS",
    });

    const result = await renormalizeEntries("lt");

    expect(result).toMatchObject({ scanned: 1, updated: 1 });
    const [row] = await db.select().from(entries).where(sql`${entries.id} = ${en}`);
    expect(row.answerNormalized).toBe("ZUVIS");
  });

  it("skips a row whose new form collides, and keeps going", async () => {
    // Both rows normalize to ŽUVIS under the new rules, but `(languageCode,
    // answerNormalized, clue)` is unique — one of them can't be rewritten.
    await seed({
      languageCode: "lt",
      clue: "Plaukioja vandenyje",
      answer: "žuvis",
      answerNormalized: "ZUVIS",
    });
    await seed({
      languageCode: "lt",
      clue: "Plaukioja vandenyje",
      answer: "Žuvis",
      answerNormalized: "ŽUVIS",
    });
    await seed({
      languageCode: "lt",
      clue: "Miško gyvūnas",
      answer: "šernas",
      answerNormalized: "SERNAS",
    });

    const result = await renormalizeEntries("lt");

    expect(result.scanned).toBe(3);
    expect(result.updated).toBe(1);
    expect(result.skipped).toHaveLength(1);
    // The row after the collision was still processed.
    const rows = await db.select().from(entries);
    expect(rows.map((r) => r.answerNormalized).sort()).toEqual(["ZUVIS", "ŠERNAS", "ŽUVIS"]);
  });
});
