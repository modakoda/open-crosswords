import { describe, expect, it } from "vitest";
import { freshness, selectCandidates } from "./select";
import type { Candidate } from "./types";

function cand(over: Partial<Candidate> & { id: string }): Candidate {
  return {
    clue: `clue ${over.id}`,
    answer: over.id.toUpperCase(),
    answerNormalized: (over.answerNormalized ?? "ABCDE").toUpperCase(),
    categoryId: null,
    difficulty: 3,
    timesUsed: 0,
    lastUsedAt: null,
    ...over,
  };
}

const NOW = new Date("2026-09-01T00:00:00Z");

describe("freshness", () => {
  it("ranks an unused entry above a heavily used one", () => {
    const fresh = cand({ id: "a", timesUsed: 0, lastUsedAt: null });
    const stale = cand({ id: "b", timesUsed: 40, lastUsedAt: NOW });
    expect(freshness(fresh, NOW)).toBeGreaterThan(freshness(stale, NOW));
  });

  it("rewards entries not used recently", () => {
    const old = cand({ id: "a", timesUsed: 2, lastUsedAt: new Date("2026-01-01") });
    const recent = cand({ id: "b", timesUsed: 2, lastUsedAt: new Date("2026-08-30") });
    expect(freshness(old, NOW)).toBeGreaterThan(freshness(recent, NOW));
  });
});

describe("selectCandidates", () => {
  const pool: Candidate[] = [
    ...Array.from({ length: 10 }, (_, i) =>
      cand({ id: `geo${i}`, categoryId: "geo", answerNormalized: "PARIS" }),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      cand({ id: `sci${i}`, categoryId: "sci", answerNormalized: "ATOM" }),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      cand({ id: `art${i}`, categoryId: "art", answerNormalized: "OPERA" }),
    ),
  ];

  it("spreads picks across categories (round-robin)", () => {
    const picked = selectCandidates(pool, { seed: "s1", poolSize: 9, now: NOW });
    const cats = picked.slice(0, 3).map((c) => c.categoryId);
    expect(new Set(cats).size).toBe(3);
  });

  it("drops candidates outside the requested difficulty band", () => {
    const mixed = [
      cand({ id: "e1", difficulty: 1 }),
      cand({ id: "e2", difficulty: 2 }),
      cand({ id: "m1", difficulty: 3 }),
      cand({ id: "h1", difficulty: 5 }),
    ];
    const easy = selectCandidates(mixed, {
      seed: "s1",
      now: NOW,
      minDifficulty: 1,
      maxDifficulty: 2,
    });
    expect(easy.map((c) => c.id).sort()).toEqual(["e1", "e2"]);
  });

  it("keeps every difficulty when no band is given", () => {
    const mixed = [
      cand({ id: "e1", difficulty: 1 }),
      cand({ id: "h1", difficulty: 5 }),
    ];
    expect(selectCandidates(mixed, { seed: "s1", now: NOW })).toHaveLength(2);
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const a = selectCandidates(pool, { seed: "s1", now: NOW }).map((c) => c.id);
    const b = selectCandidates(pool, { seed: "s1", now: NOW }).map((c) => c.id);
    const c = selectCandidates(pool, { seed: "s2", now: NOW }).map((c) => c.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("filters by requested category ids", () => {
    const picked = selectCandidates(pool, {
      seed: "s1",
      categoryIds: ["geo"],
      now: NOW,
    });
    expect(picked.every((c) => c.categoryId === "geo")).toBe(true);
  });

  it("drops answers shorter than minLength", () => {
    const withShort = [...pool, cand({ id: "x", answerNormalized: "AB" })];
    const picked = selectCandidates(withShort, { seed: "s", now: NOW });
    expect(picked.find((c) => c.id === "x")).toBeUndefined();
  });

  it("prefers fresher entries within a category", () => {
    const mixed = [
      cand({ id: "used", categoryId: "geo", timesUsed: 50, lastUsedAt: NOW }),
      ...Array.from({ length: 5 }, (_, i) =>
        cand({ id: `fresh${i}`, categoryId: "geo", timesUsed: 0 }),
      ),
    ];
    const picked = selectCandidates(mixed, { seed: "s", poolSize: 3, now: NOW });
    expect(picked.map((c) => c.id)).not.toContain("used");
  });
});
