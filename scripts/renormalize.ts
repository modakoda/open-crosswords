import "./load-env";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../src/db";
import { entries } from "../src/db/schema";
import { normalizeAnswer } from "../src/lib/crossword/normalize";

/**
 * Recompute `answerNormalized` (and `length`) for every entry from its own
 * `answer` and language. Needed after the normalizer's rules change for a
 * language — rows written under the old rules keep the old grid letters
 * otherwise, so a Lithuanian answer stored as `ZUVIS` never interlocks with a
 * freshly added `ŽUVIS`.
 *
 * Idempotent, and only writes the rows that actually change, so it is safe to
 * re-run over a library of any size.
 *
 * Usage: npm run renormalize -- [languageCode]
 */
const PAGE_SIZE = 1000;

async function main() {
  const languageCode = process.argv[2];
  const scope = languageCode ? eq(entries.languageCode, languageCode) : undefined;

  // Keyset pagination on the primary key: a whole library can run to millions
  // of rows, which is more than one `select` should pull into memory.
  let cursor = "00000000-0000-0000-0000-000000000000";
  let scanned = 0;
  let updated = 0;

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
      await db
        .update(entries)
        .set({
          answerNormalized,
          length: Array.from(answerNormalized).length,
          updatedAt: new Date(),
        })
        .where(eq(entries.id, row.id));
      updated += 1;
    }

    scanned += page.length;
    cursor = page[page.length - 1].id;
    if (scanned % 50_000 === 0) console.log(`  scanned ${scanned}, updated ${updated}`);
  }

  console.log(`Renormalized ${updated} of ${scanned} entries`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
