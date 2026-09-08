import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, entries, languages, puzzles } from "@/db/schema";
import { slugify } from "@/lib/slug";

/**
 * The library's taxonomy: the content languages, and the topic categories
 * scoped to each one. Kept apart from the clue/answer rows in `entries.ts`
 * because every write path there has to reach for these first — a language
 * has to exist before an entry can name it, and a category before an entry
 * can be filed under it.
 */

export async function listLanguages() {
  return db.select().from(languages).orderBy(languages.name);
}

export async function ensureLanguage(code: string, name?: string) {
  await db
    .insert(languages)
    .values({ code, name: name ?? code.toUpperCase() })
    .onConflictDoNothing();
}

/**
 * The languages screen's listing: every language with what is filed under it,
 * so an admin can tell an empty code left by a typo from one the library
 * actually depends on. The counts come from correlated subqueries rather than
 * joins — joining both tables at once multiplies the rows and would need a
 * `count(distinct)` over the product.
 */
export async function listLanguagesWithCounts() {
  const countOf = (table: typeof entries | typeof categories | typeof puzzles) =>
    sql<number>`(select count(*) from ${table} where ${table.languageCode} = ${languages.code})`;

  const rows = await db
    .select({
      code: languages.code,
      name: languages.name,
      createdAt: languages.createdAt,
      entryCount: countOf(entries),
      categoryCount: countOf(categories),
      puzzleCount: countOf(puzzles),
    })
    .from(languages)
    .orderBy(languages.name);

  // postgres.js hands back `count(*)` as a string (bigint); PGlite as a number.
  return rows.map((r) => ({
    ...r,
    entryCount: Number(r.entryCount),
    categoryCount: Number(r.categoryCount),
    puzzleCount: Number(r.puzzleCount),
  }));
}

/** Renames a language in place. The code is its primary key and never moves. */
export async function renameLanguage(code: string, name: string) {
  const [row] = await db
    .update(languages)
    .set({ name })
    .where(eq(languages.code, code))
    .returning();
  return row;
}

/**
 * Drops a language, but only while nothing depends on it. Returns the removed
 * row, or `undefined` when there was nothing to remove *or* the language is
 * still in use; the caller tells those apart with `languageExists`.
 *
 * The parent row is locked before anything is counted, and that ordering is
 * load-bearing rather than incidental. A child insert naming this language
 * takes a `FOR KEY SHARE` lock on it, which conflicts with `FOR UPDATE`, so
 * the lock blocks every new entry and puzzle for the language until this
 * transaction ends — which is what makes the emptiness check still true at the
 * moment of the delete. A single guarded `DELETE ... WHERE NOT EXISTS(...)`
 * would not: its subqueries are evaluated before it reaches the row lock, so
 * an insert committing in between would be cascaded away with the language
 * (`entries` cascades) or, for a puzzle, would fail the delete on the foreign
 * key instead of being refused cleanly.
 *
 * Categories go with it — they cascade, and a category can't outlive the
 * language it is scoped to. Puzzles deliberately don't, which is why they are
 * one of the two things that block the delete.
 */
export async function deleteLanguage(code: string) {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ code: languages.code })
      .from(languages)
      .where(eq(languages.code, code))
      .for("update");
    if (!locked) return undefined;

    const [{ inUse }] = await tx
      .select({
        inUse: sql<boolean>`(exists (select 1 from ${entries} where ${entries.languageCode} = ${code})
          or exists (select 1 from ${puzzles} where ${puzzles.languageCode} = ${code}))`,
      })
      .from(languages)
      .where(eq(languages.code, code));
    if (inUse) return undefined;

    const [row] = await tx
      .delete(languages)
      .where(eq(languages.code, code))
      .returning();
    return row;
  });
}

/** Whether the library already has this language — see `updateEntry`. */
export async function languageExists(code: string) {
  const [row] = await db
    .select({ code: languages.code })
    .from(languages)
    .where(eq(languages.code, code));
  return row !== undefined;
}

export async function listCategories(languageCode: string) {
  return db
    .select()
    .from(categories)
    .where(eq(categories.languageCode, languageCode))
    .orderBy(categories.name);
}

export async function ensureCategory(languageCode: string, name: string) {
  const slug = slugify(name) || "general";
  await ensureLanguage(languageCode);
  const [row] = await db
    .insert(categories)
    .values({ languageCode, slug, name })
    .onConflictDoUpdate({
      target: [categories.languageCode, categories.slug],
      set: { name },
    })
    .returning();
  return row;
}
