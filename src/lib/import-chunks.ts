/**
 * Split a large import payload into request-sized pieces.
 *
 * A single `admin.entries.import` call is bounded three ways: the RPC route's
 * 1 MB body cap, `importSchema.text`'s 500,000-character cap, and the
 * handler's 2000-row cap. Rather than raise any of those, a big file is sent
 * as several requests that each fit inside all three.
 */

import { parseCsv } from "@/lib/csv";
import type { ImportFormat } from "@/lib/import-file";

/** Well under the handler's 2000-row cap, so a chunk is never rejected for size. */
export const MAX_CHUNK_ROWS = 500;

/**
 * Well under both the 500,000-character schema cap and the 1 MB body cap,
 * leaving room for the surrounding JSON envelope and multi-byte characters.
 */
export const MAX_CHUNK_BYTES = 300_000;

export class ImportChunkError extends Error {}

const encoder = new TextEncoder();

/**
 * Turn import text into one or more payloads, each safe to send on its own.
 * Small inputs come back as a single unchanged chunk.
 */
export function splitImportText(text: string, format: ImportFormat): string[] {
  return format === "json" ? splitJson(text) : splitCsv(text);
}

function splitJson(text: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Malformed input that would fit in one request is forwarded as-is, so the
    // server reports the parse error it always has. Anything larger cannot be
    // sent at all, so say so here.
    if (fitsBytes(text)) return [text];
    throw new ImportChunkError("Invalid JSON");
  }

  const rows = Array.isArray(data) ? data : (data as { entries?: unknown })?.entries;
  if (!Array.isArray(rows)) {
    if (fitsBytes(text)) return [text];
    throw new ImportChunkError("Expected a JSON array or { entries: [...] }");
  }
  if (rows.length <= MAX_CHUNK_ROWS && fitsBytes(text)) return [text];

  return group(rows.map((row) => JSON.stringify(row)), "[", "]", ",");
}

function splitCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length - 1 <= MAX_CHUNK_ROWS && fitsBytes(text)) return [text];
  if (lines.length < 2) {
    throw new ImportChunkError("CSV needs a header row and at least one data row");
  }
  const [header, ...rows] = lines;
  // parseCsv understands quoted newlines; a row holding one cannot be split by
  // line, so leave the text whole and let the server judge it.
  if (parseCsv(text).length !== lines.length) return [text];

  return group(rows, `${header}\n`, "", "\n");
}

/** Greedily pack serialized rows into chunks that satisfy both caps. */
function group(rows: string[], open: string, close: string, sep: string): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let bytes = byteLength(open) + byteLength(close);

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(open + current.join(sep) + close);
    current = [];
    bytes = byteLength(open) + byteLength(close);
  };

  for (const row of rows) {
    const cost = byteLength(row) + byteLength(sep);
    if (current.length > 0 && (current.length >= MAX_CHUNK_ROWS || bytes + cost > MAX_CHUNK_BYTES)) {
      flush();
    }
    current.push(row);
    bytes += cost;
  }
  flush();

  if (chunks.length === 0) throw new ImportChunkError("Nothing to import");
  return chunks;
}

function fitsBytes(text: string): boolean {
  return byteLength(text) <= MAX_CHUNK_BYTES;
}

function byteLength(text: string): number {
  return encoder.encode(text).length;
}
