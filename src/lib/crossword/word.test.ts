import { describe, expect, it } from "vitest";
import type { Cell } from "./types";
import { cellKey, wordCells, wordEntryCell } from "./word";

// C A T · D
// O · ·  · O
const grid: Cell[][] = [
  [{ solution: "C", number: 1 }, { solution: "A" }, { solution: "T" }, null, { solution: "D", number: 2 }],
  [{ solution: "O" }, null, null, null, { solution: "O" }],
];

describe("wordCells", () => {
  it("returns the whole across run from any cell in it", () => {
    expect(wordCells(grid, 0, 1, "across")).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
  });

  it("stops at a block instead of running into the next word", () => {
    expect(wordCells(grid, 0, 4, "across")).toEqual([[0, 4]]);
  });

  it("walks up to the start of a down run", () => {
    expect(wordCells(grid, 1, 0, "down")).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it("returns nothing for a block", () => {
    expect(wordCells(grid, 1, 1, "across")).toEqual([]);
  });
});

describe("wordEntryCell", () => {
  const cells = wordCells(grid, 0, 0, "across");

  it("picks the first cell when the word is empty", () => {
    expect(wordEntryCell(cells, {})).toEqual([0, 0]);
  });

  it("skips cells that already hold a letter", () => {
    expect(wordEntryCell(cells, { [cellKey(0, 0)]: "C" })).toEqual([0, 1]);
  });

  it("falls back to the first cell when the word is full", () => {
    const full = { [cellKey(0, 0)]: "C", [cellKey(0, 1)]: "A", [cellKey(0, 2)]: "T" };
    expect(wordEntryCell(cells, full)).toEqual([0, 0]);
  });

  it("returns undefined when there is no word", () => {
    expect(wordEntryCell([], {})).toBeUndefined();
  });
});
