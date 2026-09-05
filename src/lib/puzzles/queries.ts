import { and, between, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { entries, puzzles } from "@/db/schema";
import { buildCrossword } from "@/lib/crossword";
import type { Candidate, Placement } from "@/lib/crossword/types";
import { randomSeed } from "@/lib/crossword/rng";
import { difficultyRange, type DifficultyLevel } from "@/lib/difficulty";
import { paperToGrid } from "@/lib/paper";
import type { GeneratePuzzleInput } from "@/lib/validation/schemas";
import { toClues, type PuzzleDTO, type PuzzleSummary } from "./types";

/** Why generation could not produce a puzzle, for the UI to translate. */
export type NotEnoughEntriesReason = "no-entries" | "no-interlock";

export class NotEnoughEntriesError extends Error {
  constructor(
    readonly reason: NotEnoughEntriesReason,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Fetch a random sample of enabled entries to hand to the placement engine.
 * Ordering by random() (rather than a stable column) matters once a
 * language/category has more rows than `limit`: a stable order would always
 * surface the same subset and the rest would never be selectable.
 */
export async function fetchCandidatePool(
  languageCode: string,
  categoryIds: string[] | undefined,
  difficulty?: DifficultyLevel,
  limit = 2000,
): Promise<Candidate[]> {
  const { min, max } = difficultyRange(difficulty);
  const filters = [
    eq(entries.languageCode, languageCode),
    eq(entries.enabled, 1),
    between(entries.difficulty, min, max),
  ];
  if (categoryIds?.length) {
    filters.push(inArray(entries.categoryId, categoryIds));
  }

  const rows = await db
    .select({
      id: entries.id,
      clue: entries.clue,
      answer: entries.answer,
      answerNormalized: entries.answerNormalized,
      categoryId: entries.categoryId,
      difficulty: entries.difficulty,
      timesUsed: entries.timesUsed,
      lastUsedAt: entries.lastUsedAt,
    })
    .from(entries)
    .where(and(...filters))
    .orderBy(sql`random()`)
    .limit(limit);

  return rows.map((r) => ({ ...r }));
}

export async function generatePuzzle(
  input: GeneratePuzzleInput,
  userId: string | null = null,
): Promise<PuzzleDTO> {
  const candidates = await fetchCandidatePool(
    input.languageCode,
    input.categoryIds,
    input.difficulty,
  );
  if (candidates.length < 4) {
    throw new NotEnoughEntriesError(
      "no-entries",
      "Need at least 4 enabled entries for this language/category/difficulty selection",
    );
  }

  const { maxSize, targetWords } = paperToGrid(
    input.paperSize as never,
    input.orientation as never,
  );
  const seed = input.seed ?? randomSeed();
  const { min: minDifficulty, max: maxDifficulty } = difficultyRange(input.difficulty);
  const crossword = buildCrossword(candidates, {
    seed,
    maxSize,
    targetWords,
    categoryIds: input.categoryIds,
    minDifficulty,
    maxDifficulty,
  });

  if (crossword.placements.length < 4) {
    throw new NotEnoughEntriesError(
      "no-interlock",
      "Could not interlock enough of the selected entries into a grid",
    );
  }

  const slug = nanoid(10);
  const title =
    input.title ?? `${input.languageCode.toUpperCase()} crossword`;
  const usedIds = crossword.placements.map((p) => p.entryId);

  const id = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(puzzles)
      .values({
        slug,
        title,
        languageCode: input.languageCode,
        userId,
        paperSize: input.paperSize,
        orientation: input.orientation,
        width: crossword.width,
        height: crossword.height,
        seed,
        placements: crossword.placements,
        grid: crossword.grid,
      })
      .returning({ id: puzzles.id });
    await tx
      .update(entries)
      .set({
        timesUsed: sql`${entries.timesUsed} + 1`,
        lastUsedAt: new Date(),
      })
      .where(inArray(entries.id, usedIds));
    return inserted.id;
  });

  return {
    id,
    slug,
    title,
    languageCode: input.languageCode,
    paperSize: input.paperSize,
    orientation: input.orientation,
    width: crossword.width,
    height: crossword.height,
    grid: crossword.grid,
    clues: toClues(crossword.placements),
    createdAt: new Date().toISOString(),
  };
}

export async function listPuzzlesForUser(userId: string): Promise<PuzzleSummary[]> {
  const rows = await db
    .select({
      slug: puzzles.slug,
      title: puzzles.title,
      languageCode: puzzles.languageCode,
      createdAt: puzzles.createdAt,
    })
    .from(puzzles)
    .where(eq(puzzles.userId, userId))
    .orderBy(desc(puzzles.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function getPuzzleBySlug(slug: string): Promise<PuzzleDTO | null> {
  const row = await db.query.puzzles.findFirst({
    where: eq(puzzles.slug, slug),
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    languageCode: row.languageCode,
    paperSize: row.paperSize,
    orientation: row.orientation,
    width: row.width,
    height: row.height,
    grid: row.grid as PuzzleDTO["grid"],
    clues: toClues(row.placements as Placement[]),
    createdAt: row.createdAt.toISOString(),
  };
}
