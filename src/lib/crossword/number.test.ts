import { describe, expect, it } from "vitest";
import { assignNumbers } from "./number";
import type { Cell, Crossword } from "./types";

function g(rows: string[]): Cell[][] {
  return rows.map((row) =>
    [...row].map((ch) => (ch === "." ? null : { solution: ch })),
  );
}

describe("assignNumbers", () => {
  it("numbers word starts left-to-right, top-to-bottom", () => {
    // C A T
    // . R .
    // . E .
    const grid = g(["CAT", ".R.", ".E."]);
    const cw: Crossword = {
      width: 3,
      height: 3,
      grid,
      unplaced: [],
      placements: [
        { entryId: "1", number: 0, row: 0, col: 0, direction: "across", answer: "CAT", clue: "" },
        { entryId: "2", number: 0, row: 0, col: 1, direction: "down", answer: "ARE", clue: "" },
      ],
    };
    const out = assignNumbers(cw);
    expect(out.grid[0][0]?.number).toBe(1);
    expect(out.grid[0][1]?.number).toBe(2);
    expect(out.grid[0][2]?.number).toBeUndefined();
    const across = out.placements.find((p) => p.direction === "across")!;
    const down = out.placements.find((p) => p.direction === "down")!;
    expect(across.number).toBe(1);
    expect(down.number).toBe(2);
  });

  it("gives a shared start cell a single number for both directions", () => {
    const grid = g(["CAR", "..O", "..T"]);
    const cw: Crossword = {
      width: 3,
      height: 3,
      grid,
      unplaced: [],
      placements: [
        { entryId: "1", number: 0, row: 0, col: 0, direction: "across", answer: "CAR", clue: "" },
        { entryId: "2", number: 0, row: 0, col: 2, direction: "down", answer: "ROT", clue: "" },
      ],
    };
    const out = assignNumbers(cw);
    expect(out.grid[0][2]?.number).toBe(2);
    expect(out.placements.find((p) => p.direction === "down")!.number).toBe(2);
  });
});
