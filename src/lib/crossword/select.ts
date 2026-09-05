import type { Candidate } from "./types";
import { makeRng, shuffle } from "./rng";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface SelectOptions {
  /** Restrict to these category ids (null id = uncategorised, matched by "null"). */
  categoryIds?: string[];
  /** Minimum normalized answer length worth putting in a grid. Default 3. */
  minLength?: number;
  maxLength?: number;
  /** Inclusive entry-difficulty bounds (1..5). Default: the whole scale. */
  minDifficulty?: number;
  maxDifficulty?: number;
  /** How many candidates to hand the placement engine. Default max(40, target*4). */
  poolSize?: number;
  targetWords?: number;
  seed?: string;
  now?: Date;
}

/** 0..1, higher = fresher (used less, and less recently). */
export function freshness(c: Candidate, now: Date): number {
  const useScore = 1 / (1 + Math.max(0, c.timesUsed));
  const recency = c.lastUsedAt
    ? Math.min(1, Math.max(0, (now.getTime() - c.lastUsedAt.getTime()) / THIRTY_DAYS_MS))
    : 1;
  return 0.6 * useScore + 0.4 * recency;
}

/**
 * Order candidates so the crossword generator draws a fresh, topic-diverse set:
 * bucket by category, rank each bucket by freshness (with light seeded jitter so
 * repeated generations differ), then round-robin across buckets for topic spread.
 */
export function selectCandidates(
  candidates: Candidate[],
  opts: SelectOptions = {},
): Candidate[] {
  const rng = makeRng(opts.seed ?? "default");
  const now = opts.now ?? new Date();
  const minLength = opts.minLength ?? 3;
  const maxLength = opts.maxLength ?? 21;
  const minDifficulty = opts.minDifficulty ?? 1;
  const maxDifficulty = opts.maxDifficulty ?? 5;
  const target = opts.targetWords ?? 18;
  const poolSize = opts.poolSize ?? Math.max(40, target * 4);

  const allowed = opts.categoryIds && opts.categoryIds.length > 0
    ? new Set(opts.categoryIds)
    : null;

  const eligible = candidates.filter((c) => {
    const len = c.answerNormalized.length;
    if (len < minLength || len > maxLength) return false;
    if (c.difficulty < minDifficulty || c.difficulty > maxDifficulty) return false;
    if (allowed) return allowed.has(c.categoryId ?? "null");
    return true;
  });

  const buckets = new Map<string, Candidate[]>();
  for (const c of eligible) {
    const key = c.categoryId ?? "null";
    const list = buckets.get(key) ?? [];
    list.push(c);
    buckets.set(key, list);
  }

  for (const list of buckets.values()) {
    list.sort(
      (a, b) =>
        freshness(b, now) + rng() * 0.15 - (freshness(a, now) + rng() * 0.15),
    );
  }

  const order = shuffle([...buckets.keys()], rng);
  const cursors = new Map(order.map((k) => [k, 0]));
  const picked: Candidate[] = [];

  let exhausted = false;
  while (picked.length < poolSize && !exhausted) {
    exhausted = true;
    for (const key of order) {
      const list = buckets.get(key)!;
      const i = cursors.get(key)!;
      if (i < list.length) {
        picked.push(list[i]);
        cursors.set(key, i + 1);
        exhausted = false;
        if (picked.length >= poolSize) break;
      }
    }
  }

  return picked;
}
