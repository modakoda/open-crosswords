import type { DIFFICULTY_LEVELS } from "@/lib/validation/schemas";

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

/**
 * Inclusive entry-difficulty bounds (the 1..5 stored on `entries.difficulty`)
 * each selectable level draws from. Bands overlap on purpose: "medium" happily
 * reuses the harder easy clues, so a level never starves for candidates.
 */
const RANGES: Record<DifficultyLevel, { min: number; max: number }> = {
  any: { min: 1, max: 5 },
  easy: { min: 1, max: 2 },
  medium: { min: 2, max: 4 },
  hard: { min: 4, max: 5 },
};

/** Bounds for a level; an unset level means "any". */
export function difficultyRange(level?: DifficultyLevel) {
  return RANGES[level ?? "any"];
}
