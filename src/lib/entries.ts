import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, entries } from "@/db/schema";
import { normalizeAnswer, isPlaceableAnswer } from "@/lib/crossword/normalize";
import { ensureLanguage, languageExists } from "@/lib/taxonomy";
import type {
  CreateEntryInput,
  listEntriesQuerySchema,
} from "@/lib/validation/schemas";
import type { z } from "zod";

export class DuplicateEntryError extends Error {}
export class InvalidAnswerError extends Error {}
export class CategoryLanguageError extends Error {}
export class UnknownLanguageError extends Error {}

type ListQuery = z.infer<typeof listEntriesQuerySchema>;

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
    // Join the category name so a listing spanning several languages can label
    // each row — the caller only holds the categories of one language.
    db
      .select({
        id: entries.id,
        languageCode: entries.languageCode,
        categoryId: entries.categoryId,
        categoryName: categories.name,
        clue: entries.clue,
        answer: entries.answer,
        answerNormalized: entries.answerNormalized,
        length: entries.length,
        difficulty: entries.difficulty,
        enabled: entries.enabled,
        timesUsed: entries.timesUsed,
        createdAt: entries.createdAt,
      })
      .from(entries)
      .leftJoin(categories, eq(entries.categoryId, categories.id))
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
  const answerNormalized = normalizeAnswer(input.answer, input.languageCode);
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
        length: Array.from(answerNormalized).length,
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

/**
 * Patches one entry. Two things make this more than a `set`:
 *
 * - The language can move, but a category can't follow it — categories are
 *   scoped to one language. A move without a stated category therefore clears
 *   it, and a stated one has to belong to the language the row ends up in.
 * - `(languageCode, answerNormalized, clue)` is unique, so an edit can collide
 *   with an existing row exactly like a create can.
 */
export async function updateEntry(
  id: string,
  patch: Partial<{
    languageCode: string;
    categoryId: string | null;
    clue: string;
    answer: string;
    difficulty: number;
    enabled: boolean;
  }>,
) {
  const [current] = await db.select().from(entries).where(eq(entries.id, id));
  if (!current) return null;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  const languageCode = patch.languageCode ?? current.languageCode;
  if (patch.languageCode !== undefined) {
    // Moving an entry means moving it into a language the library already has.
    // Creating one is `admin.languages.create`'s job — an edit that invents a
    // language would put it in the public picker as a side effect.
    if (!(await languageExists(patch.languageCode))) {
      throw new UnknownLanguageError(`No such language: ${patch.languageCode}`);
    }
    set.languageCode = patch.languageCode;
  }
  if (patch.clue !== undefined) set.clue = patch.clue;
  if (patch.difficulty !== undefined) set.difficulty = patch.difficulty;
  if (patch.enabled !== undefined) set.enabled = patch.enabled ? 1 : 0;
  // The grid form depends on the language as well as the answer — an alphabet
  // decides which accents are letters of their own (see `normalizeAnswer`) —
  // so a move has to recompute it even when the answer itself stands.
  if (patch.answer !== undefined || languageCode !== current.languageCode) {
    const answer = patch.answer ?? current.answer;
    const answerNormalized = normalizeAnswer(answer, languageCode);
    if (!isPlaceableAnswer(answerNormalized)) {
      throw new InvalidAnswerError("Answer must contain 2-21 letters");
    }
    if (patch.answer !== undefined) set.answer = answer;
    set.answerNormalized = answerNormalized;
    set.length = Array.from(answerNormalized).length;
  }

  if ("categoryId" in patch) {
    set.categoryId = patch.categoryId ?? null;
  } else if (languageCode !== current.languageCode) {
    // The caller said nothing about the category, and the one it has belongs
    // to the language being left behind. Dropping it is the only coherent
    // outcome — keeping it would file the row under a foreign language's topic.
    set.categoryId = null;
  }
  if (typeof set.categoryId === "string") {
    await assertCategoryLanguage(set.categoryId, languageCode);
  }

  try {
    const [row] = await db
      .update(entries)
      .set(set)
      .where(eq(entries.id, id))
      .returning();
    return row ?? null;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DuplicateEntryError("An identical clue/answer already exists");
    }
    throw err;
  }
}

async function assertCategoryLanguage(categoryId: string, languageCode: string) {
  const [row] = await db
    .select({ languageCode: categories.languageCode })
    .from(categories)
    .where(eq(categories.id, categoryId));
  if (!row || row.languageCode !== languageCode) {
    throw new CategoryLanguageError(
      `That category doesn't belong to the ${languageCode} library`,
    );
  }
}

export async function deleteEntry(id: string) {
  const [row] = await db
    .delete(entries)
    .where(eq(entries.id, id))
    .returning({ id: entries.id });
  return row ?? null;
}

/**
 * Deletes several entries in one statement. Ids that match nothing are simply
 * absent from the result, so a stale selection deletes what still exists
 * rather than failing the whole batch.
 */
export async function deleteEntries(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .delete(entries)
    .where(inArray(entries.id, ids))
    .returning({ id: entries.id });
}
