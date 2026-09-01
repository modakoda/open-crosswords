import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, entries, languages } from "@/db/schema";
import { normalizeAnswer, isPlaceableAnswer } from "@/lib/crossword/normalize";
import { slugify } from "@/lib/slug";
import type {
  CreateEntryInput,
  listEntriesQuerySchema,
} from "@/lib/validation/schemas";
import type { z } from "zod";

export class DuplicateEntryError extends Error {}
export class InvalidAnswerError extends Error {}

type ListQuery = z.infer<typeof listEntriesQuerySchema>;

export async function listLanguages() {
  return db.select().from(languages).orderBy(languages.name);
}

export async function ensureLanguage(code: string, name?: string) {
  await db
    .insert(languages)
    .values({ code, name: name ?? code.toUpperCase() })
    .onConflictDoNothing();
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

export async function listEntries(q: ListQuery) {
  const filters = [];
  if (q.languageCode) filters.push(eq(entries.languageCode, q.languageCode));
  if (q.categoryId) filters.push(eq(entries.categoryId, q.categoryId));
  if (q.q) {
    // Treat the search term literally — escape LIKE metacharacters.
    const term = `%${q.q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(entries.clue, term), ilike(entries.answer, term))!);
  }
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select()
      .from(entries)
      .where(where)
      .orderBy(desc(entries.createdAt))
      .limit(q.limit)
      .offset(q.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(entries)
      .where(where),
  ]);
  return { rows, total: count };
}

export async function createEntry(input: CreateEntryInput) {
  const answerNormalized = normalizeAnswer(input.answer);
  if (!isPlaceableAnswer(answerNormalized)) {
    throw new InvalidAnswerError(
      "Answer must contain 2-21 letters after normalization",
    );
  }
  await ensureLanguage(input.languageCode);
  try {
    const [row] = await db
      .insert(entries)
      .values({
        languageCode: input.languageCode,
        categoryId: input.categoryId ?? null,
        clue: input.clue,
        answer: input.answer,
        answerNormalized,
        length: answerNormalized.length,
        difficulty: input.difficulty,
        source: input.source,
      })
      .returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DuplicateEntryError("An identical clue/answer already exists");
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: string }).code;
    if (code === "23505") return true;
    if (/duplicate key value|unique constraint/i.test(String((e as Error)?.message ?? ""))) {
      return true;
    }
  }
  return false;
}

export async function updateEntry(
  id: string,
  patch: Partial<{
    categoryId: string | null;
    clue: string;
    answer: string;
    difficulty: number;
    enabled: boolean;
  }>,
) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if ("categoryId" in patch) set.categoryId = patch.categoryId ?? null;
  if (patch.clue !== undefined) set.clue = patch.clue;
  if (patch.difficulty !== undefined) set.difficulty = patch.difficulty;
  if (patch.enabled !== undefined) set.enabled = patch.enabled ? 1 : 0;
  if (patch.answer !== undefined) {
    const answerNormalized = normalizeAnswer(patch.answer);
    if (!isPlaceableAnswer(answerNormalized)) {
      throw new InvalidAnswerError("Answer must contain 2-21 letters");
    }
    set.answer = patch.answer;
    set.answerNormalized = answerNormalized;
    set.length = answerNormalized.length;
  }
  const [row] = await db
    .update(entries)
    .set(set)
    .where(eq(entries.id, id))
    .returning();
  return row ?? null;
}

export async function deleteEntry(id: string) {
  const [row] = await db
    .delete(entries)
    .where(eq(entries.id, id))
    .returning({ id: entries.id });
  return row ?? null;
}
