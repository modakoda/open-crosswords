import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { entries, puzzles } from "@/db/schema";
import { buildCrossword } from "@/lib/crossword";
import type { Candidate, Cell, Placement } from "@/lib/crossword/types";
import { randomSeed } from "@/lib/crossword/rng";
import { paperToGrid } from "@/lib/paper";
import type { GeneratePuzzleInput } from "@/lib/validation/schemas";

export class NotEnoughEntriesError extends Error {}

export interface PuzzleClue {
  number: number;
  clue: string;
  answer: string;
  length: number;
  row: number;
  col: number;
}

export interface PuzzleDTO {
  slug: string;
  title: string;
  languageCode: string;
  paperSize: string;
  orientation: string;
  width: number;
  height: number;
  grid: Cell[][];
  clues: { across: PuzzleClue[]; down: PuzzleClue[] };
  createdAt: string;
}

function toClues(placements: Placement[]) {
  const map = (p: Placement): PuzzleClue => ({
    number: p.number,
    clue: p.clue,
    answer: p.answer,
    length: p.answer.length,
    row: p.row,
    col: p.col,
  });
  return {
    across: placements.filter((p) => p.direction === "across").map(map),
    down: placements.filter((p) => p.direction === "down").map(map),
  };
}

export async function generatePuzzle(input: GeneratePuzzleInput): Promise<PuzzleDTO> {
  const filters = [
    eq(entries.languageCode, input.languageCode),
    eq(entries.enabled, 1),
  ];
  if (input.categoryIds?.length) {
    filters.push(inArray(entries.categoryId, input.categoryIds));
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
    .orderBy(entries.id)
    .limit(2000);

  const candidates: Candidate[] = rows.map((r) => ({ ...r }));
  if (candidates.length < 4) {
    throw new NotEnoughEntriesError(
      "Need at least 4 enabled entries for this language/category selection",
    );
  }

  const { maxSize, targetWords } = paperToGrid(
    input.paperSize as never,
    input.orientation as never,
  );
  const seed = input.seed ?? randomSeed();
  const crossword = buildCrossword(candidates, {
    seed,
    maxSize,
    targetWords,
    categoryIds: input.categoryIds,
  });

  if (crossword.placements.length < 4) {
    throw new NotEnoughEntriesError(
      "Could not interlock enough of the selected entries into a grid",
    );
  }

  const slug = nanoid(10);
  const title =
    input.title ?? `${input.languageCode.toUpperCase()} crossword`;
  const usedIds = crossword.placements.map((p) => p.entryId);

  await db.transaction(async (tx) => {
    await tx.insert(puzzles).values({
      slug,
      title,
      languageCode: input.languageCode,
      paperSize: input.paperSize,
      orientation: input.orientation,
      width: crossword.width,
      height: crossword.height,
      seed,
      placements: crossword.placements,
      grid: crossword.grid,
    });
    await tx
      .update(entries)
      .set({
        timesUsed: sql`${entries.timesUsed} + 1`,
        lastUsedAt: new Date(),
      })
      .where(inArray(entries.id, usedIds));
  });

  return {
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

export async function getPuzzleBySlug(slug: string): Promise<PuzzleDTO | null> {
  const row = await db.query.puzzles.findFirst({
    where: eq(puzzles.slug, slug),
  });
  if (!row) return null;
  return {
    slug: row.slug,
    title: row.title,
    languageCode: row.languageCode,
    paperSize: row.paperSize,
    orientation: row.orientation,
    width: row.width,
    height: row.height,
    grid: row.grid as Cell[][],
    clues: toClues(row.placements as Placement[]),
    createdAt: row.createdAt.toISOString(),
  };
}
