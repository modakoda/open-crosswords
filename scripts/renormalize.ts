import "./load-env";
import { renormalizeEntries } from "../src/lib/renormalize";
import { LANGUAGE_CODE } from "../src/lib/validation/schemas";

/**
 * Rewrite every entry's grid form after `src/lib/crossword/normalize.ts`'s
 * rules change for a language.
 *
 * Usage: npm run renormalize -- [languageCode]
 */
async function main() {
  const arg = process.argv[2];
  const parsed = arg ? LANGUAGE_CODE.safeParse(arg) : undefined;
  if (parsed && !parsed.success) {
    console.error(`Not a language code: ${arg}`);
    process.exit(2);
  }

  const result = await renormalizeEntries(parsed?.data, (scanned, updated) => {
    if (scanned % 50_000 === 0) console.log(`  scanned ${scanned}, updated ${updated}`);
  });

  for (const s of result.skipped) console.warn(`  skipped ${s.id}: ${s.reason}`);
  console.log(
    `Renormalized ${result.updated} of ${result.scanned} entries` +
      (result.skipped.length ? `, skipped ${result.skipped.length}` : ""),
  );
  process.exit(result.skipped.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
