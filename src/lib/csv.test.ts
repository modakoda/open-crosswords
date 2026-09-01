import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple table", () => {
    expect(parseCsv("a,b\n1,2\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles quoted fields with commas and quotes", () => {
    const rows = parseCsv('clue,answer\n"Capital, of France","Paris"\n"He said ""hi""",X');
    expect(rows[1]).toEqual(["Capital, of France", "Paris"]);
    expect(rows[2]).toEqual(['He said "hi"', "X"]);
  });

  it("handles newlines inside quotes and CRLF", () => {
    const rows = parseCsv('a,b\r\n"line1\nline2",y\r\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["line1\nline2", "y"],
    ]);
  });

  it("drops fully blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
