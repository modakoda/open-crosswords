import { randomInt } from "node:crypto";
import { SLUG_ADJECTIVES, SLUG_NOUNS } from "./slug-words";

/** Digits appended to every generated slug (100000-999999). */
const NUMBER_MIN = 100_000;
const NUMBER_MAX = 1_000_000;

/** Shape of a generated slug: four lowercase words plus a six-digit number. */
export const PUZZLE_SLUG_PATTERN = /^[a-z]+(-[a-z]+){3}-\d{6}$/;

function pick<T>(pool: readonly T[]): T {
  return pool[randomInt(pool.length)];
}

/**
 * Build a public puzzle slug like `amber-quiet-otter-canyon-483921`.
 *
 * Readable but not guessable: 128 adjectives twice, 256 nouns twice and a
 * six-digit number are ~50 bits of CSPRNG entropy, so slugs stay as
 * unenumerable as the random ids they replaced. Always server-generated —
 * never derived from client input.
 */
export function generatePuzzleSlug(): string {
  return [
    pick(SLUG_ADJECTIVES),
    pick(SLUG_ADJECTIVES),
    pick(SLUG_NOUNS),
    pick(SLUG_NOUNS),
    randomInt(NUMBER_MIN, NUMBER_MAX),
  ].join("-");
}
