export * from "./types";

import type { Candidate, Crossword, GenerateOptions } from "./types";
import { selectCandidates, type SelectOptions } from "./select";
import { generateCrossword } from "./generate";

export interface BuildOptions extends SelectOptions, GenerateOptions {}

/**
 * One-shot: smart-select a pool from raw candidates, then build the crossword.
 * Retries generation on a widened pool if the first pass places too few words.
 */
export function buildCrossword(
  candidates: Candidate[],
  options: BuildOptions = {},
): Crossword {
  const target = options.targetWords ?? 18;
  const pool = selectCandidates(candidates, options);
  let best = generateCrossword(pool, options);

  if (best.placements.length < Math.min(target, 6) && pool.length < candidates.length) {
    const wider = selectCandidates(candidates, { ...options, poolSize: candidates.length });
    const retry = generateCrossword(wider, options);
    if (retry.placements.length > best.placements.length) best = retry;
  }
  return best;
}
