import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { entries } from "@/db/schema";
import { isPlaceableAnswer, normalizeAnswer } from "@/lib/crossword/normalize";

/**
 * Recompute `answerNormalized` (and `length`) for every entry from its own
 * `answer` and language. Needed after the normalizer's rules change for a
 * language — rows written under the old rules keep the old grid letters
 * otherwise, so a Lithuanian answer stored as `ZUVIS` never interlocks with a
 * freshly added `ŽUVIS`.
 *
 * Idempotent, and only writes the rows that actually change, so it is safe to
 * re-run over a library of any size. Admin-run maintenance (`npm run
 * renormalize`), not something a request can reach.
 */

/** A whole library can run to millions of rows — more than one `select` should hold. */
const PAGE_SIZE = 1000;

export interface RenormalizeResult {
  scanned: number;
  updated: number;
  /** Rows the new rules can't write, left in their old form. */
  skipped: { id: string; reason: string }[];
}

export async function renormalizeEntries(
  languageCode?: string,
  onProgress?: (scanned: number, updated: number) => void,
): Promise<RenormalizeResult> {
  const scope = languageCode ? eq(entries.languageCode, languageCode) : undefined;
  // Keyset pagination on the primary key, so the pass holds one page at a time.
  let cursor = "00000000-0000-0000-0000-000000000000";
  const result: RenormalizeResult = { scanned: 0, updated: 0, skipped: [] };

  for (;;) {
    const page = await db
      .select({
        id: entries.id,
        languageCode: entries.languageCode,
        answer: entries.answer,
        answerNormalized: entries.answerNormalized,
      })
      .from(entries)
      .where(scope ? and(scope, gt(entries.id, cursor)) : gt(entries.id, cursor))
      .orderBy(asc(entries.id))
      .limit(PAGE_SIZE);
    if (page.length === 0) break;

    for (const row of page) {
      const answerNormalized = normalizeAnswer(row.answer, row.languageCode);
      if (answerNormalized === row.answerNormalized) continue;
      // The two things every write path checks: the row still has to be
      // placeable, and `(languageCode, answerNormalized, clue)` is unique — a
      // rules change can fold two rows onto each other. Neither is a reason to
      // abandon the rest of the library halfway through, so both are recorded
      // and skipped, which also keeps the run repeatable.
      if (!isPlaceableAnswer(answerNormalized)) {
        result.skipped.push({ id: row.id, reason: `"${answerNormalized}" is unplaceable` });
        continue;
      }
      try {
        await db
          .update(entries)
          .set({ answerNormalized, length: answerNormalized.length, updatedAt: new Date() })
          .where(eq(entries.id, row.id));
        result.updated += 1;
      } catch (err) {
        result.skipped.push({ id: row.id, reason: (err as Error).message });
      }
    }

    result.scanned += page.length;
    cursor = page[page.length - 1].id;
    onProgress?.(result.scanned, result.updated);
  }

  return result;
}
