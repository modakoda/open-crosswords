import { describe, expect, it } from "vitest";
import { paperToGrid, type PaperSize, type Orientation } from "./paper";
import {
  clueBlockMm,
  clueSpaceMm,
  contentBox,
  fitCellMm,
  sheetLayout,
  type ClueText,
} from "./print-layout";

const clues = (count: number, length: number): ClueText[] =>
  Array.from({ length: count }, () => ({ length }));

/** Asserts a layout's clue text is estimated to fit the sheet it was made for. */
function expectFits(
  paperSize: string,
  orientation: string,
  rows: number,
  clues: ClueText[],
  layout: ReturnType<typeof sheetLayout>,
) {
  const box = contentBox(paperSize, orientation);
  expect(
    clueBlockMm(clues, layout.clueColumns, layout.clueFontPt, box.width),
  ).toBeLessThanOrEqual(clueSpaceMm(box, rows, layout.cellMm));
}

describe("contentBox", () => {
  it("subtracts the print margin from both axes", () => {
    expect(contentBox("a4", "portrait")).toEqual({ width: 186, height: 273 });
  });

  it("swaps the axes in landscape", () => {
    expect(contentBox("a4", "landscape")).toEqual({ width: 273, height: 186 });
  });

  it("falls back to A4 for an unknown paper size", () => {
    expect(contentBox("papyrus", "portrait")).toEqual(
      contentBox("a4", "portrait"),
    );
  });
});

describe("fitCellMm", () => {
  it("keeps the 7mm default when the grid is small", () => {
    expect(fitCellMm(3, 1, contentBox("a4", "portrait"))).toBe(7);
  });

  it("shrinks a wide grid until it fits the content width", () => {
    const box = contentBox("a5", "portrait");
    const cell = fitCellMm(40, 10, box);
    expect(cell * 40).toBeLessThanOrEqual(box.width);
    expect(cell).toBeLessThan(7);
  });

  it("shrinks a tall grid so it leaves room for clues", () => {
    const box = contentBox("a4", "portrait");
    const cell = fitCellMm(25, 45, box);
    expect(cell * 45).toBeLessThan(box.height * 0.7);
  });
});

describe("clueBlockMm", () => {
  it("wraps long clues onto more lines than short ones", () => {
    const short = clueBlockMm(clues(20, 20), 2, 8, 186);
    const long = clueBlockMm(clues(20, 200), 2, 8, 186);
    expect(long).toBeGreaterThan(short);
  });

  it("gets shorter as columns are added when clues stay on one line", () => {
    const two = clueBlockMm(clues(40, 25), 2, 8, 186);
    const three = clueBlockMm(clues(40, 25), 3, 8, 186);
    expect(three).toBeLessThan(two);
  });

  it("gets taller as columns are added when the extra wrapping outweighs them", () => {
    const two = clueBlockMm(clues(40, 60), 2, 8, 186);
    const three = clueBlockMm(clues(40, 60), 3, 8, 186);
    expect(three).toBeGreaterThan(two);
  });
});

describe("sheetLayout", () => {
  it("emits explicit oriented page dimensions for the @page rule", () => {
    expect(
      sheetLayout({
        paperSize: "a4",
        orientation: "landscape",
        cols: 10,
        rows: 10,
        clues: clues(10, 40),
      }).pageCss,
    ).toBe("297mm 210mm");
  });

  it("keeps the largest font and fewest columns for a light puzzle", () => {
    const layout = sheetLayout({
      paperSize: "a4",
      orientation: "portrait",
      cols: 10,
      rows: 10,
      clues: clues(10, 40),
    });
    expect(layout.clueFontPt).toBe(9.5);
    expect(layout.clueColumns).toBe(2);
    expect(layout.cellMm).toBe(7);
  });

  it("shrinks the grid so a dense puzzle's clues still fit one sheet", () => {
    const dense = clues(50, 90);
    const layout = sheetLayout({
      paperSize: "a4",
      orientation: "portrait",
      cols: 23,
      rows: 23,
      clues: dense,
    });
    expect(layout.cellMm).toBeLessThan(7);
    expectFits("a4", "portrait", 23, dense, layout);
  });

  it("fits every paper size at the largest grid the generator can produce", () => {
    const papers: PaperSize[] = ["a4", "a5", "letter", "legal"];
    const orientations: Orientation[] = ["portrait", "landscape"];
    for (const paperSize of papers) {
      for (const orientation of orientations) {
        const { maxSize, targetWords } = paperToGrid(paperSize, orientation);
        // Worst realistic case: every clue long enough to wrap, answers shown.
        const worst = clues(targetWords, 110);
        const layout = sheetLayout({
          paperSize,
          orientation,
          cols: maxSize,
          rows: maxSize,
          clues: worst,
        });
        expectFits(paperSize, orientation, maxSize, worst, layout);
      }
    }
  });

  it("never lets the grid or the font run past their floors", () => {
    const layout = sheetLayout({
      paperSize: "a5",
      orientation: "portrait",
      cols: 25,
      rows: 25,
      clues: clues(140, 160),
    });
    expect(layout.cellMm).toBeGreaterThanOrEqual(3.4);
    expect(layout.clueFontPt).toBeGreaterThanOrEqual(5);
  });
});
