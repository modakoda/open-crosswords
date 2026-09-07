/**
 * Alphabets whose accented characters are letters in their own right, not
 * decorated versions of a base letter. `ž` and `z` are different letters in
 * Lithuanian the way `p` and `q` are in English, so folding them together
 * would put the wrong letter in the grid and merge answers that don't rhyme,
 * let alone match. Keyed by the base language subtag (`lt-lt` uses `lt`).
 *
 * A language absent from here keeps the default fold-to-base behaviour, which
 * is what a solver of e.g. French or Spanish expects — grids there are
 * conventionally written without accents. Add a language by listing the
 * uppercase forms of the letters its alphabet counts as distinct.
 */
const DISTINCT_LETTERS: Record<string, string> = {
  lt: "ĄČĘĖĮŠŲŪŽ",
};

const alphabets = new Map<string, Set<string>>();

function distinctLetters(languageCode?: string): Set<string> {
  const base = languageCode?.toLowerCase().split("-")[0] ?? "";
  let set = alphabets.get(base);
  if (!set) {
    // `hasOwn`, not a bare lookup: `DISTINCT_LETTERS` is a plain object, so a
    // code like `constructor` would otherwise reach an inherited value. Nothing
    // over HTTP can be one (`LANGUAGE_CODE` pins the shape), but the CLI entry
    // points take a language straight from argv.
    set = new Set(Object.hasOwn(DISTINCT_LETTERS, base) ? DISTINCT_LETTERS[base] : "");
    alphabets.set(base, set);
  }
  return set;
}

/** Strip combining marks and anything that isn't a letter. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}]/gu, "");
}

/**
 * Fold an answer to the letters that go in the grid: uppercase, drop anything
 * that is not a letter, and reduce accented characters to their base letter —
 * except the ones `languageCode`'s alphabet treats as letters of their own,
 * which are kept as typed. Non-Latin scripts (Greek, Cyrillic) pass through
 * either way, since they carry no combining marks to strip.
 */
export function normalizeAnswer(raw: string, languageCode?: string): string {
  const keep = distinctLetters(languageCode);
  let out = "";
  for (const ch of raw.normalize("NFC").toUpperCase()) {
    out += keep.has(ch) ? ch : fold(ch);
  }
  return out;
}

const MIN_ANSWER_LENGTH = 2;
const MAX_ANSWER_LENGTH = 21;

export function isPlaceableAnswer(normalized: string): boolean {
  // Counted in UTF-16 units, the same way `generate` slices a word into cells.
  return (
    normalized.length >= MIN_ANSWER_LENGTH &&
    normalized.length <= MAX_ANSWER_LENGTH
  );
}
