import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, languages } from "@/db/schema";
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
