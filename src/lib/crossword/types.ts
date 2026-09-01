export type Direction = "across" | "down";

/** An entry as consumed by the generator (DB-shape-independent). */
export interface Candidate {
  id: string;
  clue: string;
  answer: string;
  /** Uppercase A-Z, length >= 2. */
  answerNormalized: string;
  categoryId: string | null;
  difficulty: number;
  timesUsed: number;
  lastUsedAt: Date | null;
}

export interface Placement {
  entryId: string;
  number: number;
  row: number;
  col: number;
  direction: Direction;
  answer: string;
  clue: string;
}

/** A single grid cell. `null` means a block (no cell). */
export type Cell = null | {
  solution: string;
  /** Present only on cells that start an across and/or down word. */
  number?: number;
};

export interface Crossword {
  width: number;
  height: number;
  grid: Cell[][];
  placements: Placement[];
  /** Candidate ids that could not be placed. */
  unplaced: string[];
}

export interface GenerateOptions {
  /** Max grid dimension (square bound). Default 21. */
  maxSize?: number;
  /** Target number of placed words. Default 18. */
  targetWords?: number;
  /** Deterministic seed. */
  seed?: string;
}
