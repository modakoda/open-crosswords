import { randomInt } from "node:crypto";
import { SLUG_ADJECTIVES, SLUG_NOUNS } from "./slug-words";

/** Digits appended to every generated slug (10000000-99999999). */
const NUMBER_MIN = 10_000_000;
const NUMBER_MAX = 100_000_000;

/** Shape of a generated slug: four lowercase words plus an eight-digit number. */
export const PUZZLE_SLUG_PATTERN = /^[a-z]+(-[a-z]+){3}-\d{8}$/;

function pick<T>(pool: readonly T[]): T {
  return pool[randomInt(pool.length)];
}

/**
 * Build a public puzzle slug like `amber-quiet-otter-canyon-48392174`.
 *
 * Readable but not guessable: 128 adjectives twice, 256 nouns twice and an
 * eight-digit number are ~56 bits of CSPRNG entropy, so slugs stay as
 * unenumerable as the random ids they replaced — the slug is the only thing
 * guarding a puzzle, and nothing rate-limits reads. Always server-generated,
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
