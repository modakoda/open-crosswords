/** Client-side handling for picking a JSON/CSV file to feed the paste-based import. */

export type ImportFormat = "json" | "csv";

/**
 * A picked file may be far larger than one request's limits — `splitImportText`
 * in src/lib/import-chunks.ts breaks it into request-sized pieces. This ceiling
 * only guards the browser against parsing something absurd.
 */
export const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;

export const IMPORT_FILE_ACCEPT = ".json,.csv,application/json,text/csv,text/plain";

export class ImportFileError extends Error {}

/** Pick the import format from a file name's extension, or null if unrecognised. */
export function formatFromFileName(name: string): ImportFormat | null {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "json") return "json";
  if (ext === "csv") return "csv";
  return null;
}

/**
 * Read a picked file into the text the import procedure already accepts.
 * Nothing is uploaded — the file never leaves the browser as a file.
 */
export async function readImportFile(
  file: File,
): Promise<{ text: string; format: ImportFormat }> {
  const format = formatFromFileName(file.name);
  if (!format) {
    throw new ImportFileError("Choose a .json or .csv file");
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new ImportFileError("File is too large to import");
  }
  const text = await file.text();
  if (text.trim().length === 0) {
    throw new ImportFileError("That file is empty");
  }
  return { text, format };
}
