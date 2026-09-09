import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseImportText } from "@/lib/import";
import { normalizeAnswer, isPlaceableAnswer } from "@/lib/crossword/normalize";
import { selectCandidates } from "@/lib/crossword/select";
import { generateCrossword } from "@/lib/crossword/generate";
import { difficultyRange } from "@/lib/difficulty";
import { paperToGrid } from "@/lib/paper";
import type { Candidate } from "@/lib/crossword/types";

/**
 * Guards the bundled Lithuanian data files rather than any one function: a
 * seed file that `npm run seed` would reject, or that can't fill a grid at the
 * difficulty it claims, is a shipped defect even though nothing in `src/`
 * changed.
 */
function load(file: string) {
  const raw = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "..", "data", file), "utf8"),
  );
  return { language: raw.language, rows: parseImportText(JSON.stringify(raw.entries), "json") };
}

function toCandidates(rows: ReturnType<typeof load>["rows"]): Candidate[] {
  const categoryIds = new Map<string, string>();
  return rows.map((r, i) => {
    const key = r.category ?? "null";
    if (!categoryIds.has(key)) categoryIds.set(key, `cat-${categoryIds.size}`);
    return {
      id: `entry-${i}`,
      clue: r.clue,
      answer: r.answer,
      answerNormalized: normalizeAnswer(r.answer, "lt"),
      categoryId: categoryIds.get(key)!,
      difficulty: r.difficulty ?? 3,
      timesUsed: 0,
      lastUsedAt: null,
    };
  });
}

describe("data/seed-lt-hard.json", () => {
  const { language, rows } = load("seed-lt-hard.json");

  it("is a Lithuanian file the seed script accepts", () => {
    expect(language).toEqual({ code: "lt", name: "Lietuvių" });
    expect(rows.length).toBeGreaterThan(250);
  });

  it("holds only difficulties the hard level draws from", () => {
    const { min, max } = difficultyRange("hard");
    for (const r of rows) {
      expect(r.difficulty).toBeGreaterThanOrEqual(min);
      expect(r.difficulty).toBeLessThanOrEqual(max);
    }
  });

  it("normalizes every answer to a placeable Lithuanian word", () => {
    for (const r of rows) {
      const n = normalizeAnswer(r.answer, "lt");
      expect(isPlaceableAnswer(n), `${r.answer} -> ${n}`).toBe(true);
      // `selectCandidates` drops anything under three letters by default.
      expect(n.length, r.answer).toBeGreaterThanOrEqual(3);
    }
  });

  it("repeats no answer, in itself or against the starter set", () => {
    const starter = new Set(
      load("seed-lt.json").rows.map((r) => normalizeAnswer(r.answer, "lt")),
    );
    const seen = new Set<string>();
    for (const r of rows) {
      const n = normalizeAnswer(r.answer, "lt");
      expect(seen.has(n), `duplicate in file: ${r.answer}`).toBe(false);
      expect(starter.has(n), `also in seed-lt.json: ${r.answer}`).toBe(false);
      seen.add(n);
    }
  });

  it("fills a full A4 grid on its own at the hard difficulty", () => {
    const candidates = toCandidates(rows);
    const { min, max } = difficultyRange("hard");
    const { maxSize, targetWords } = paperToGrid("a4", "portrait");

    for (const seed of ["one", "two", "three", "four", "five"]) {
      const pool = selectCandidates(candidates, {
        seed,
        targetWords,
        minDifficulty: min,
        maxDifficulty: max,
        maxLength: maxSize,
      });
      const crossword = generateCrossword(pool, { seed, maxSize, targetWords });
      expect(crossword.placements.length, `seed ${seed}`).toBe(targetWords);
    }
  });
});
