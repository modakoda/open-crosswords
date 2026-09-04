import type { Cell, Placement } from "@/lib/crossword/types";

export interface PuzzleClue {
  number: number;
  clue: string;
  answer: string;
  length: number;
  row: number;
  col: number;
}

export interface PuzzleDTO {
  id: string;
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

export interface PuzzleSummary {
  slug: string;
  title: string;
  languageCode: string;
  createdAt: string;
}

export function toClues(placements: Placement[]) {
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
