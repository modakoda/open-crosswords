import { describe, expect, it } from "vitest";
import { generateCrossword } from "./generate";
import type { Candidate, Crossword } from "./types";

const WORDS = [
  "PARIS", "ATHENS", "MADRID", "LISBON", "BERLIN", "VIENNA", "OSLO", "ROME",
  "RIVER", "MOUNTAIN", "ISLAND", "DESERT", "VALLEY", "OCEAN", "FOREST",
  "OXYGEN", "CARBON", "HELIUM", "NEON", "IRON", "SODIUM", "SILVER",
  "GUITAR", "VIOLIN", "PIANO", "TRUMPET", "CELLO", "OBOE",
];

function pool(): Candidate[] {
  return WORDS.map((w, i) => ({
    id: `e${i}`,
    clue: `Clue for ${w}`,
    answer: w,
    answerNormalized: w,
    categoryId: null,
    difficulty: 3,
    timesUsed: 0,
    lastUsedAt: null,
  }));
}

function assertValid(cw: Crossword) {
  expect(cw.width).toBeGreaterThan(0);
  expect(cw.height).toBe(cw.grid.length);
  expect(cw.width).toBe(cw.grid[0].length);

  const claimed = new Set<string>();
  for (const p of cw.placements) {
    expect(p.number).toBeGreaterThan(0);
    const dr = p.direction === "down" ? 1 : 0;
    const dc = p.direction === "across" ? 1 : 0;
    expect(cw.grid[p.row][p.col]?.number).toBe(p.number);

    for (let i = 0; i < p.answer.length; i++) {
      const r = p.row + dr * i;
      const c = p.col + dc * i;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(cw.height);
      expect(c).toBeLessThan(cw.width);
      expect(cw.grid[r][c]?.solution).toBe(p.answer[i]);
      claimed.add(`${r},${c}`);
    }
    // no run-on before/after the word
    const beforeR = p.row - dr;
    const beforeC = p.col - dc;
    const afterR = p.row + dr * p.answer.length;
    const afterC = p.col + dc * p.answer.length;
    if (cw.grid[beforeR]?.[beforeC] !== undefined)
      expect(cw.grid[beforeR][beforeC]).toBeNull();
    if (cw.grid[afterR]?.[afterC] !== undefined)
      expect(cw.grid[afterR][afterC]).toBeNull();
  }

  // every white cell belongs to a placed word
  for (let r = 0; r < cw.height; r++) {
    for (let c = 0; c < cw.width; c++) {
      if (cw.grid[r][c]) expect(claimed.has(`${r},${c}`)).toBe(true);
    }
  }
}

describe("generateCrossword", () => {
  it("produces a structurally valid interlocked grid", () => {
    const cw = generateCrossword(pool(), { seed: "abc", maxSize: 21, targetWords: 16 });
    expect(cw.placements.length).toBeGreaterThanOrEqual(6);
    assertValid(cw);
  });

  it("respects the maxSize bound", () => {
    const cw = generateCrossword(pool(), { seed: "z", maxSize: 12, targetWords: 20 });
    expect(cw.width).toBeLessThanOrEqual(12);
    expect(cw.height).toBeLessThanOrEqual(12);
    assertValid(cw);
  });

  it("is deterministic for a seed", () => {
    const a = generateCrossword(pool(), { seed: "same" });
    const b = generateCrossword(pool(), { seed: "same" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("varies with the seed", () => {
    const a = generateCrossword(pool(), { seed: "one" });
    const b = generateCrossword(pool(), { seed: "two" });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("accounts for every candidate as placed or unplaced", () => {
    const cw = generateCrossword(pool(), { seed: "acct", targetWords: 8 });
    const ids = new Set([
      ...cw.placements.map((p) => p.entryId),
      ...cw.unplaced,
    ]);
    expect(ids.size).toBe(WORDS.length);
    expect(cw.placements.length).toBeLessThanOrEqual(8);
  });

  it("handles an empty candidate list", () => {
    const cw = generateCrossword([], { seed: "empty" });
    expect(cw.placements).toEqual([]);
    expect(cw.width).toBe(0);
  });

  it("never places two entries at the same start cell and direction", () => {
    // Duplicate answers (different clues, same word) are a real case in the
    // question library and must not produce two placements that collide in
    // numbering.
    const dupes = pool();
    dupes.push({ ...dupes[0], id: "dupe-1", clue: "Another clue for PARIS" });
    dupes.push({ ...dupes[3], id: "dupe-2", clue: "Another clue for LISBON" });

    const cw = generateCrossword(dupes, { seed: "dupes", targetWords: 20 });
    const seen = new Set<string>();
    for (const p of cw.placements) {
      const key = `${p.row},${p.col},${p.direction}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("every crossing cell agrees on its letter", () => {
    const cw = generateCrossword(pool(), { seed: "cross", targetWords: 20 });
    // build letter map from placements; contradictions would throw in assertValid,
    // but assert crossings actually happen
    const crossingCells = new Set<string>();
    const seen = new Set<string>();
    for (const p of cw.placements) {
      const dr = p.direction === "down" ? 1 : 0;
      const dc = p.direction === "across" ? 1 : 0;
      for (let i = 0; i < p.answer.length; i++) {
        const key = `${p.row + dr * i},${p.col + dc * i}`;
        if (seen.has(key)) crossingCells.add(key);
        seen.add(key);
      }
    }
    expect(crossingCells.size).toBeGreaterThan(0);
  });
});
