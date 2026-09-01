import type {
  Candidate,
  Cell,
  Crossword,
  Direction,
  GenerateOptions,
  Placement,
} from "./types";
import { makeRng } from "./rng";
import { assignNumbers } from "./number";

// Coordinates can go negative as words extend left/up from the origin word,
// so bias by OFF to keep the packed key positive and modulo-decodable.
const OFF = 1000;
const STRIDE = 100000;
const KEY = (r: number, c: number) => (r + OFF) * STRIDE + (c + OFF);

interface Working {
  letters: Map<number, string>;
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
}

function writeWord(
  w: Working,
  word: string,
  row: number,
  col: number,
  dir: Direction,
): void {
  const dr = dir === "down" ? 1 : 0;
  const dc = dir === "across" ? 1 : 0;
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    w.letters.set(KEY(r, c), word[i]);
    w.minR = Math.min(w.minR, r);
    w.maxR = Math.max(w.maxR, r);
    w.minC = Math.min(w.minC, c);
    w.maxC = Math.max(w.maxC, c);
  }
}

/** Returns crossing count for a legal placement, or null if it does not fit. */
function fits(
  w: Working,
  word: string,
  row: number,
  col: number,
  dir: Direction,
  maxSize: number,
): number | null {
  const dr = dir === "down" ? 1 : 0;
  const dc = dir === "across" ? 1 : 0;
  const len = word.length;

  if (w.letters.has(KEY(row - dr, col - dc))) return null;
  if (w.letters.has(KEY(row + dr * len, col + dc * len))) return null;

  let crossings = 0;
  for (let i = 0; i < len; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = w.letters.get(KEY(r, c));
    if (existing !== undefined) {
      if (existing !== word[i]) return null;
      crossings++;
    } else if (
      w.letters.has(KEY(r + dc, c + dr)) ||
      w.letters.has(KEY(r - dc, c - dr))
    ) {
      return null;
    }
  }
  if (crossings === 0) return null;

  const bbW = Math.max(w.maxC, col + dc * (len - 1)) - Math.min(w.minC, col) + 1;
  const bbH = Math.max(w.maxR, row + dr * (len - 1)) - Math.min(w.minR, row) + 1;
  if (bbW > maxSize || bbH > maxSize) return null;

  return crossings;
}

function crop(
  w: Working,
  placements: Placement[],
  unplaced: string[],
): Crossword {
  const height = w.maxR - w.minR + 1;
  const width = w.maxC - w.minC + 1;
  const grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null as Cell),
  );
  for (const [key, letter] of w.letters) {
    const r = Math.floor(key / STRIDE) - OFF - w.minR;
    const c = (key % STRIDE) - OFF - w.minC;
    grid[r][c] = { solution: letter };
  }
  const shifted = placements.map((p) => ({
    ...p,
    row: p.row - w.minR,
    col: p.col - w.minC,
  }));
  return assignNumbers({ width, height, grid, placements: shifted, unplaced });
}

/**
 * Greedy interlocking crossword builder. Consumes an already-ordered candidate
 * pool (see selectCandidates) and places as many as interlock cleanly, up to
 * `targetWords`, inside a `maxSize` square.
 */
export function generateCrossword(
  candidates: Candidate[],
  options: GenerateOptions = {},
): Crossword {
  const maxSize = options.maxSize ?? 21;
  const target = options.targetWords ?? 18;
  const rng = makeRng(options.seed ?? "default");

  const usable = candidates.filter(
    (c) =>
      c.answerNormalized.length >= 2 && c.answerNormalized.length <= maxSize,
  );
  const placements: Placement[] = [];
  const unplaced: string[] = [];

  if (usable.length === 0) {
    return { width: 0, height: 0, grid: [], placements: [], unplaced: [] };
  }

  const w: Working = { letters: new Map(), minR: 0, maxR: 0, minC: 0, maxC: 0 };
  const [first, ...rest] = usable;
  writeWord(w, first.answerNormalized, 0, 0, "across");
  placements.push({
    entryId: first.id,
    number: 0,
    row: 0,
    col: 0,
    direction: "across",
    answer: first.answerNormalized,
    clue: first.clue,
  });

  for (const cand of rest) {
    if (placements.length >= target) {
      unplaced.push(cand.id);
      continue;
    }
    const word = cand.answerNormalized;
    let best: { row: number; col: number; dir: Direction; score: number } | null =
      null;

    for (let li = 0; li < word.length; li++) {
      for (const p of placements) {
        for (let pi = 0; pi < p.answer.length; pi++) {
          if (p.answer[pi] !== word[li]) continue;
          const anchorR = p.direction === "down" ? p.row + pi : p.row;
          const anchorC = p.direction === "across" ? p.col + pi : p.col;
          const dir: Direction = p.direction === "across" ? "down" : "across";
          const row = dir === "down" ? anchorR - li : anchorR;
          const col = dir === "across" ? anchorC - li : anchorC;
          const crossings = fits(w, word, row, col, dir, maxSize);
          if (crossings === null) continue;
          const growth =
            Math.max(0, Math.min(w.minR, row) * -1 + w.maxR) +
            Math.max(0, Math.min(w.minC, col) * -1 + w.maxC);
          const score = crossings * 10 + rng() * 2 - growth * 0.05;
          if (!best || score > best.score) best = { row, col, dir, score };
        }
      }
    }

    if (!best) {
      unplaced.push(cand.id);
      continue;
    }
    writeWord(w, word, best.row, best.col, best.dir);
    placements.push({
      entryId: cand.id,
      number: 0,
      row: best.row,
      col: best.col,
      direction: best.dir,
      answer: word,
      clue: cand.clue,
    });
  }

  return crop(w, placements, unplaced);
}
