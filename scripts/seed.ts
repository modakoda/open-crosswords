import "./load-env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importSchema } from "../src/lib/validation/schemas";
import { parseImportText, importEntries } from "../src/lib/import";
import { ensureLanguage } from "../src/lib/entries";

/**
 * Seed the question library from a data file.
 * Usage: npm run seed -- [path/to/file.json]   (defaults to data/seed-en.json)
 */
async function main() {
  const path = process.argv[2] ?? "data/seed-en.json";
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));

  const language = raw.language ?? { code: "en", name: "English" };
  await ensureLanguage(language.code, language.name);

  const text = JSON.stringify(raw.entries ?? raw);
  importSchema.parse({ languageCode: language.code, format: "json", text });

  const rows = parseImportText(text, "json");
  const result = await importEntries(language.code, rows, true);

  console.log(
    `Seeded ${language.code}: inserted ${result.inserted}, skipped ${result.skipped}, errors ${result.errors.length}`,
  );
  for (const e of result.errors) console.warn(`  row ${e.row}: ${e.message}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
