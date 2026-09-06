import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { puzzles, user } from "@/db/schema";
import type { z } from "zod";
import type { listPuzzlesQuerySchema } from "@/lib/validation/schemas";

type ListQuery = z.infer<typeof listPuzzlesQuerySchema>;

/** One row of the admin puzzle listing — grid shape plus who generated it. */
export interface AdminPuzzleRow {
  id: string;
  slug: string;
  title: string;
  languageCode: string;
  paperSize: string;
  orientation: string;
  width: number;
  height: number;
  wordCount: number;
  ownerEmail: string | null;
  createdAt: string;
}

/**
 * Every puzzle in the library, newest first — the admin view is deliberately
 * unscoped (unlike `listPuzzlesForUser`), which is why it may only ever be
 * reached through `adminProcedure`.
 */
export async function listPuzzles(
  q: ListQuery,
): Promise<{ rows: AdminPuzzleRow[]; total: number }> {
  const filters = [];
  if (q.languageCode) filters.push(eq(puzzles.languageCode, q.languageCode));
  if (q.q) {
    // Treat the search term literally — escape LIKE metacharacters.
    const term = `%${q.q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(puzzles.title, term), ilike(puzzles.slug, term))!);
  }
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: puzzles.id,
        slug: puzzles.slug,
        title: puzzles.title,
        languageCode: puzzles.languageCode,
        paperSize: puzzles.paperSize,
        orientation: puzzles.orientation,
        width: puzzles.width,
        height: puzzles.height,
        // The placements array is the word list; counting it here avoids
        // shipping every clue and answer to the listing.
        wordCount: sql<number>`jsonb_array_length(${puzzles.placements})::int`,
        ownerEmail: user.email,
        createdAt: puzzles.createdAt,
      })
      .from(puzzles)
      .leftJoin(user, eq(puzzles.userId, user.id))
      .where(where)
      .orderBy(desc(puzzles.createdAt))
      .limit(q.limit)
      .offset(q.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(puzzles).where(where),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total: count,
  };
}

/** Deleting a puzzle drops its solve progress too (FK cascade on solve_states). */
export async function deletePuzzle(id: string) {
  const [row] = await db
    .delete(puzzles)
    .where(eq(puzzles.id, id))
    .returning({ id: puzzles.id });
  return row ?? null;
}

/** Retitle a puzzle; the slug (and so every shared link) is left untouched. */
export async function renamePuzzle(id: string, title: string) {
  const [row] = await db
    .update(puzzles)
    .set({ title })
    .where(eq(puzzles.id, id))
    .returning({ id: puzzles.id, title: puzzles.title });
  return row ?? null;
}
