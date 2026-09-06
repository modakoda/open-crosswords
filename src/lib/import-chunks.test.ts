import { describe, expect, it } from "vitest";

import {
  ImportChunkError,
  MAX_CHUNK_BYTES,
  MAX_CHUNK_ROWS,
  splitImportText,
} from "./import-chunks";

function jsonRows(n: number, clue = (i: number) => `Clue number ${i}`) {
  return Array.from({ length: n }, (_, i) => ({ clue: clue(i), answer: `Answer${i}` }));
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe("splitImportText (json)", () => {
  it("leaves a small payload as a single untouched chunk", () => {
    const text = JSON.stringify(jsonRows(3));
    expect(splitImportText(text, "json")).toEqual([text]);
  });

  it("splits a payload past the row cap and keeps every row exactly once", () => {
    const rows = jsonRows(MAX_CHUNK_ROWS * 3 + 7);
    const chunks = splitImportText(JSON.stringify(rows), "json");

    expect(chunks.length).toBeGreaterThan(1);
    const rejoined = chunks.flatMap((c) => JSON.parse(c) as unknown[]);
    expect(rejoined).toEqual(rows);
  });

  it("keeps every chunk inside both the row and byte caps", () => {
    const chunks = splitImportText(JSON.stringify(jsonRows(5000)), "json");
    for (const chunk of chunks) {
      expect((JSON.parse(chunk) as unknown[]).length).toBeLessThanOrEqual(MAX_CHUNK_ROWS);
      expect(bytes(chunk)).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
    }
  });

  it("splits on bytes when rows are long, not just on row count", () => {
    // At the row cap, but multi-byte rows push the bytes past it first.
    const rows = jsonRows(MAX_CHUNK_ROWS, (i) => `${"клуе ".repeat(90)}${i}`);
    const chunks = splitImportText(JSON.stringify(rows), "json");

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(bytes(chunk)).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
      expect((JSON.parse(chunk) as unknown[]).length).toBeLessThan(MAX_CHUNK_ROWS);
    }
  });

  it("unwraps the { entries: [...] } form", () => {
    const rows = jsonRows(1200);
    const chunks = splitImportText(JSON.stringify({ entries: rows }), "json");
    expect(chunks.flatMap((c) => JSON.parse(c) as unknown[])).toEqual(rows);
  });

  it("reports unparseable json that is too big to send in one request", () => {
    expect(() => splitImportText("x".repeat(MAX_CHUNK_BYTES + 1), "json")).toThrow(
      ImportChunkError,
    );
  });

  it("forwards small malformed json untouched, for the server to report", () => {
    expect(splitImportText("{ not an array }", "json")).toEqual(["{ not an array }"]);
  });

  it("splits a row count past the cap even when the bytes would fit", () => {
    const rows = jsonRows(MAX_CHUNK_ROWS + 1, () => "c");
    const text = JSON.stringify(rows);
    expect(bytes(text)).toBeLessThan(MAX_CHUNK_BYTES);
    expect(splitImportText(text, "json")).toHaveLength(2);
  });
});

describe("splitImportText (csv)", () => {
  function csv(n: number) {
    const rows = Array.from({ length: n }, (_, i) => `Clue number ${i},Answer${i}`);
    return ["clue,answer", ...rows].join("\n");
  }

  it("leaves a small payload untouched", () => {
    const text = csv(3);
    expect(splitImportText(text, "csv")).toEqual([text]);
  });

  it("repeats the header on every chunk", () => {
    const chunks = splitImportText(csv(4000), "csv");
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.startsWith("clue,answer\n")).toBe(true);
      expect(chunk.split("\n").length - 1).toBeLessThanOrEqual(MAX_CHUNK_ROWS);
      expect(bytes(chunk)).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
    }
  });

  it("preserves every data row across the chunks", () => {
    const chunks = splitImportText(csv(2500), "csv");
    const dataRows = chunks.flatMap((c) => c.split("\n").slice(1));
    expect(dataRows).toHaveLength(2500);
    expect(dataRows[0]).toBe("Clue number 0,Answer0");
    expect(dataRows[2499]).toBe("Clue number 2499,Answer2499");
  });

  it("does not split a csv whose quoted cells contain newlines", () => {
    const row = `"multi\nline clue",Answer`;
    const text = ["clue,answer", ...Array.from({ length: 4000 }, () => row)].join("\n");
    expect(splitImportText(text, "csv")).toEqual([text]);
  });
});
