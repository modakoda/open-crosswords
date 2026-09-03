import "./load-env";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import { importSchema } from "../src/lib/validation/schemas";
import { parseImportText, importEntries } from "../src/lib/import";
import { ensureLanguage } from "../src/lib/entries";

/** Read a seed file, transparently gunzipping a `.gz`-suffixed path. */
function readSeedFile(path: string): string {
  const buf = readFileSync(resolve(process.cwd(), path));
  return path.endsWith(".gz") ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
}

// Stay comfortably under importSchema's 500_000-char text cap per batch.
const MAX_BATCH_CHARS = 400_000;

/** Split entries into batches whose JSON text each stays under the import size cap. */
function batchBySize(entries: unknown[]): unknown[][] {
  const batches: unknown[][] = [];
  let current: unknown[] = [];
  let currentChars = 2; // "[]"
  for (const entry of entries) {
    const entryChars = JSON.stringify(entry).length + 1; // +1 for the separator
    if (current.length > 0 && currentChars + entryChars > MAX_BATCH_CHARS) {
      batches.push(current);
      current = [];
      currentChars = 2;
    }
    current.push(entry);
    currentChars += entryChars;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Seed the question library from a data file.
 * Usage: npm run seed -- [path/to/file.json]   (defaults to data/seed-en.json)
 */
async function main() {
  const path = process.argv[2] ?? "data/seed-en.json";
  const raw = JSON.parse(readSeedFile(path));

  const language = raw.language ?? { code: "en", name: "English" };
  await ensureLanguage(language.code, language.name);

  const entries: unknown[] = raw.entries ?? raw;
  const batches = batchBySize(entries);

  let inserted = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];
  let rowOffset = 0;

  for (const [i, batch] of batches.entries()) {
    const text = JSON.stringify(batch);
    importSchema.parse({ languageCode: language.code, format: "json", text });

    const rows = parseImportText(text, "json");
    const result = await importEntries(language.code, rows, true);

    inserted += result.inserted;
    skipped += result.skipped;
    for (const e of result.errors) errors.push({ row: rowOffset + e.row, message: e.message });
    rowOffset += batch.length;

    if (batches.length > 1) {
      console.log(`  batch ${i + 1}/${batches.length}: +${result.inserted} inserted`);
    }
  }

  console.log(
    `Seeded ${language.code}: inserted ${inserted}, skipped ${skipped}, errors ${errors.length}`,
  );
  for (const e of errors) console.warn(`  row ${e.row}: ${e.message}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
