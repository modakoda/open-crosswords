import { parseCsv } from "@/lib/csv";
import { createEntry, ensureCategory, DuplicateEntryError, InvalidAnswerError } from "@/lib/entries";
import { importRowSchema, type ImportRow } from "@/lib/validation/schemas";

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

/** Thrown when the input holds more rows than one request may carry. */
export class ImportTooLargeError extends Error {}

/** Turn raw JSON/CSV text into validated rows (or throw on unparseable input). */
export function parseImportText(
  text: string,
  format: "json" | "csv",
  /** Trusted callers (the CLI scripts) pass nothing and stay unbounded. */
  maxRows: number = Number.POSITIVE_INFINITY,
): ImportRow[] {
  const raw: unknown[] =
    format === "json" ? fromJson(text) : fromCsv(text);
  // Counted before validating, so an oversized payload costs one length check
  // rather than a full per-row parse of rows that are about to be rejected.
  if (raw.length > maxRows) {
    throw new ImportTooLargeError(`Import capped at ${maxRows} rows per request`);
  }
  return raw.map((r, i) => {
    const parsed = importRowSchema.safeParse(r);
    if (!parsed.success) {
      throw new Error(`Row ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    }
    return parsed.data;
  });
}

function fromJson(text: string): unknown[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { entries?: unknown[] }).entries)) {
    return (data as { entries: unknown[] }).entries;
  }
  throw new Error("Expected a JSON array or { entries: [...] }");
}

function fromCsv(text: string): unknown[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    clue: header.indexOf("clue"),
    answer: header.indexOf("answer"),
    category: header.indexOf("category"),
    difficulty: header.indexOf("difficulty"),
  };
  if (idx.clue < 0 || idx.answer < 0) {
    throw new Error("CSV header must include 'clue' and 'answer' columns");
  }
  return rows.slice(1).map((cols) => ({
    clue: cols[idx.clue]?.trim(),
    answer: cols[idx.answer]?.trim(),
    category: idx.category >= 0 ? cols[idx.category]?.trim() || undefined : undefined,
    difficulty: idx.difficulty >= 0 ? cols[idx.difficulty]?.trim() || undefined : undefined,
  }));
}

/** Insert validated rows, resolving category names to ids, tolerating dupes. */
export async function importEntries(
  languageCode: string,
  rows: ImportRow[],
  createMissingCategories: boolean,
): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };
  const categoryCache = new Map<string, string | null>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      let categoryId: string | null = null;
      if (row.category) {
        if (!categoryCache.has(row.category)) {
          if (createMissingCategories) {
            const cat = await ensureCategory(languageCode, row.category);
            categoryCache.set(row.category, cat.id);
          } else {
            categoryCache.set(row.category, null);
          }
        }
        categoryId = categoryCache.get(row.category) ?? null;
      }
      await createEntry({
        languageCode,
        categoryId,
        clue: row.clue,
        answer: row.answer,
        difficulty: row.difficulty ?? 3,
        source: "import",
      });
      result.inserted++;
    } catch (err) {
      if (err instanceof DuplicateEntryError) {
        result.skipped++;
      } else if (err instanceof InvalidAnswerError) {
        result.errors.push({ row: i + 1, message: err.message });
      } else {
        // Don't surface raw DB/driver error text to the client.
        console.error(`import row ${i + 1} failed:`, err);
        result.errors.push({ row: i + 1, message: "Could not save this row" });
      }
    }
  }
  return result;
}
