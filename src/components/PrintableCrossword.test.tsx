import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PrintableCrossword } from "./PrintableCrossword";
import type { PuzzleDTO } from "@/lib/puzzles";
import type { Cell } from "@/lib/crossword/types";

// 1x3 across word "CAT", cell 1 numbered.
const grid: Cell[][] = [
  [{ solution: "C", number: 1 }, { solution: "A" }, { solution: "T" }],
];

const puzzle: PuzzleDTO = {
  slug: "abc123",
  title: "Test Puzzle",
  languageCode: "en",
  paperSize: "a4",
  orientation: "portrait",
  width: 3,
  height: 1,
  grid,
  clues: {
    across: [
      { number: 1, clue: "Feline", answer: "CAT", length: 3, row: 0, col: 0 },
    ],
    down: [],
  },
  createdAt: new Date().toISOString(),
};

describe("PrintableCrossword", () => {
  it("pins an explicit --xw-cell-size so grid tracks match cell boxes in the PDF", () => {
    const { container } = render(<PrintableCrossword puzzle={puzzle} />);

    const root = container.querySelector(".printable") as HTMLElement;
    expect(root.style.getPropertyValue("--xw-cell-size")).toBe("7mm");

    // Every grid must size its columns from the same variable (not a divergent
    // hard-coded fallback), otherwise cells overflow their tracks when printed.
    const grids = container.querySelectorAll<HTMLElement>(".xw-grid");
    expect(grids.length).toBe(2); // puzzle sheet + answer key
    for (const g of grids) {
      expect(g.style.gridTemplateColumns).toContain("var(--xw-cell-size, 7mm)");
    }
  });

  it("renders the puzzle sheet and a separate answer key", () => {
    const { container, getAllByText } = render(
      <PrintableCrossword puzzle={puzzle} />,
    );
    expect(container.querySelector(".print-page")).not.toBeNull();
    // "CAT" letters only appear on the answer-key grid.
    expect(getAllByText("Feline").length).toBeGreaterThan(0);
  });

  it("omits the answer key (and its page break) when includeAnswers is false", () => {
    const { container, queryByText } = render(
      <PrintableCrossword puzzle={puzzle} includeAnswers={false} />,
    );
    // Only the blank puzzle grid remains.
    expect(container.querySelectorAll(".xw-grid").length).toBe(1);
    expect(queryByText(/Answer key/)).toBeNull();
    // No trailing forced page break, so no blank second sheet.
    expect(container.querySelector(".print-page")).toBeNull();
  });
});
