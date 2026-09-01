import { describe, expect, it } from "vitest";
import { parseImportText } from "./import";

describe("parseImportText", () => {
  it("parses a JSON array", () => {
    const rows = parseImportText(
      '[{"clue":"Capital of France","answer":"Paris","category":"Geo","difficulty":1}]',
      "json",
    );
    expect(rows).toEqual([
      { clue: "Capital of France", answer: "Paris", category: "Geo", difficulty: 1 },
    ]);
  });

  it("parses { entries: [...] }", () => {
    const rows = parseImportText(
      '{"entries":[{"clue":"Frozen water","answer":"Ice"}]}',
      "json",
    );
    expect(rows[0].answer).toBe("Ice");
  });

  it("parses CSV with a header row", () => {
    const rows = parseImportText(
      "clue,answer,category\nCapital of France,Paris,Geography",
      "csv",
    );
    expect(rows[0]).toMatchObject({ clue: "Capital of France", answer: "Paris" });
  });

  it("rejects rows with too-short clues", () => {
    expect(() =>
      parseImportText('[{"clue":"a","answer":"Paris"}]', "json"),
    ).toThrow(/Row 1/);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseImportText("{not json", "json")).toThrow(/Invalid JSON/);
  });

  it("rejects CSV without clue/answer columns", () => {
    expect(() => parseImportText("foo,bar\n1,2", "csv")).toThrow(/clue/);
  });
});
