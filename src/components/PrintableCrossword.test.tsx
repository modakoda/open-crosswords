import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PrintableCrossword } from "./PrintableCrossword";
import type { PuzzleDTO } from "@/lib/puzzles";
import type { Cell } from "@/lib/crossword/types";
import { getMessages } from "@/lib/i18n";

const messages = getMessages("en");

// 1x3 across word "CAT", cell 1 numbered.
const grid: Cell[][] = [
  [{ solution: "C", number: 1 }, { solution: "A" }, { solution: "T" }],
];

const puzzle: PuzzleDTO = {
  id: "00000000-0000-0000-0000-000000000000",
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
    const { container } = render(<PrintableCrossword puzzle={puzzle} messages={messages} />);

    const sheets = container.querySelectorAll<HTMLElement>(".print-sheet");
    expect(sheets.length).toBe(2); // puzzle sheet + answer key
    for (const sheet of sheets) {
      // A 3x1 grid is nowhere near the page bounds, so it keeps full size.
      expect(sheet.style.getPropertyValue("--xw-cell-size")).toBe("7mm");
    }

    // Every grid must size its columns from the same variable (not a divergent
    // hard-coded fallback), otherwise cells overflow their tracks when printed.
    const grids = container.querySelectorAll<HTMLElement>(".xw-grid");
    expect(grids.length).toBe(2);
    for (const g of grids) {
      expect(g.style.gridTemplateColumns).toContain("var(--xw-cell-size, 7mm)");
    }
  });

  it("gives each sheet the paper's content box so it cannot spill onto a second page", () => {
    const { container } = render(<PrintableCrossword puzzle={puzzle} messages={messages} />);

    expect(container.querySelector("style")?.textContent).toContain(
      "size: 210mm 297mm",
    );
    for (const sheet of container.querySelectorAll<HTMLElement>(".print-sheet")) {
      expect(sheet.style.getPropertyValue("--print-sheet-w")).toBe("186mm");
      expect(sheet.style.getPropertyValue("--print-sheet-h")).toBe("273mm");
    }
  });

  it("breaks the page after the puzzle sheet so answers start on their own page", () => {
    const { container } = render(<PrintableCrossword puzzle={puzzle} messages={messages} />);

    const sheets = container.querySelectorAll(".print-sheet");
    expect(sheets[0].classList.contains("print-page")).toBe(true);
    expect(sheets[1].classList.contains("print-page")).toBe(false);
  });

  it("renders the puzzle sheet and a separate answer key", () => {
    const { container, getByText, queryByText } = render(
      <PrintableCrossword puzzle={puzzle} messages={messages} />,
    );
    expect(container.querySelector(".print-page")).not.toBeNull();
    // The puzzle sheet lists the clue without its answer; the key appends it.
    expect(getByText("1. Feline (3)")).toBeTruthy();
    expect(getByText("1. Feline (3) — CAT")).toBeTruthy();
    expect(queryByText(/Answer key/)).toBeTruthy();
  });

  it("omits the answer key (and its page break) when includeAnswers is false", () => {
    const { container, queryByText } = render(
      <PrintableCrossword puzzle={puzzle} includeAnswers={false} messages={messages} />,
    );
    // Only the blank puzzle grid remains.
    expect(container.querySelectorAll(".xw-grid").length).toBe(1);
    expect(container.querySelectorAll(".print-sheet").length).toBe(1);
    expect(queryByText(/Answer key/)).toBeNull();
    // No trailing forced page break, so no blank second sheet.
    expect(container.querySelector(".print-page")).toBeNull();
  });
});
