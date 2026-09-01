/**
 * Fold an answer to the letters that go in the grid: decompose accents, strip
 * combining marks, drop anything that is not a letter, then uppercase. Works for
 * Latin-based languages and leaves other scripts (e.g. Greek, Cyrillic) intact.
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}]/gu, "")
    .toUpperCase();
}

export const MIN_ANSWER_LENGTH = 2;
export const MAX_ANSWER_LENGTH = 21;

export function isPlaceableAnswer(normalized: string): boolean {
  return (
    normalized.length >= MIN_ANSWER_LENGTH &&
    normalized.length <= MAX_ANSWER_LENGTH
  );
}
