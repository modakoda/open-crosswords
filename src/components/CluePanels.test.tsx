import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { CluePanels } from "./CluePanels";
import { getMessages } from "@/lib/i18n";
import type { PuzzleDTO } from "@/lib/puzzles";
import type { Cell } from "@/lib/crossword/types";
import type { Direction } from "@/lib/crossword/types";

// C A T
// O · ·
const grid: Cell[][] = [
  [{ solution: "C", number: 1 }, { solution: "A" }, { solution: "T" }],
  [{ solution: "O" }, null, null],
];

const puzzle: PuzzleDTO = {
  id: "p1",
  slug: "slug",
  title: "Test",
  languageCode: "en",
  paperSize: "a4",
  orientation: "portrait",
  width: 3,
  height: 2,
  grid,
  clues: {
    across: [{ number: 1, clue: "Feline", answer: "CAT", length: 3, row: 0, col: 0 }],
    down: [{ number: 1, clue: "Firm", answer: "CO", length: 2, row: 0, col: 0 }],
  },
  createdAt: new Date().toISOString(),
};

function leading(direction: Direction) {
  const { container } = render(
    <CluePanels
      puzzle={puzzle}
      messages={getMessages("en")}
      direction={direction}
      activeNumber={1}
      onSelectClue={vi.fn()}
    />,
  );
  return [...container.querySelectorAll("[data-direction]")].map((el) => ({
    dir: el.getAttribute("data-direction"),
    first: el.classList.contains("order-first"),
  }));
}

describe("CluePanels ordering", () => {
  it("puts the down panel first while a down clue is active", () => {
    expect(leading("down")).toEqual([
      { dir: "across", first: false },
      { dir: "down", first: true },
    ]);
  });

  it("puts the across panel first while an across clue is active", () => {
    expect(leading("across")).toEqual([
      { dir: "across", first: true },
      { dir: "down", first: false },
    ]);
  });
});
