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
