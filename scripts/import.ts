import "./load-env";
import { readFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { parseImportText, importEntries } from "../src/lib/import";
import { ensureLanguage } from "../src/lib/entries";

/**
 * Import a CSV or JSON file into one language.
 * Usage: npm run import -- <language> <path/to/file.(csv|json)>
 */
async function main() {
  const [language, path] = process.argv.slice(2);
  if (!language || !path) {
    console.error("Usage: npm run import -- <language> <file.csv|file.json>");
    process.exit(2);
  }
  const format = extname(path).toLowerCase() === ".csv" ? "csv" : "json";
  const text = readFileSync(resolve(process.cwd(), path), "utf8");

  await ensureLanguage(language);
  const rows = parseImportText(text, format);
  const result = await importEntries(language, rows, true);

  console.log(
    `Imported ${language}: inserted ${result.inserted}, skipped ${result.skipped}, errors ${result.errors.length}`,
  );
  for (const e of result.errors) console.warn(`  row ${e.row}: ${e.message}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
