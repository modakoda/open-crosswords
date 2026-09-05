import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SolveView } from "./SolveView";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getMessages } from "@/lib/i18n";
import type { PuzzleDTO } from "@/lib/puzzles";
import type { Cell } from "@/lib/crossword/types";

vi.mock("@/lib/auth-client", () => ({ useSession: () => ({ data: null }) }));
vi.mock("@/lib/orpc/client", () => ({
  orpc: {
    client: {
      solveState: {
        get: vi.fn().mockResolvedValue({ progress: null }),
        save: vi.fn().mockResolvedValue({}),
      },
    },
  },
}));

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

const activeLabel = () =>
  document.querySelector(".xw-cell.active input")?.getAttribute("aria-label");

function renderView() {
  render(
    <TooltipProvider>
      <SolveView puzzle={puzzle} messages={getMessages("en")} />
    </TooltipProvider>,
  );
}

describe("SolveView clue selection", () => {
  beforeEach(() => localStorage.clear());

  it("enters an empty word at its first cell", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: /Feline/ }));
    expect(activeLabel()).toBe("Row 1 column 1");
  });

  it("skips letters the word already has", async () => {
    localStorage.setItem("oc:solve:slug", JSON.stringify({ "0,0": "C", "0,1": "A" }));
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: /Feline/ }));
    expect(activeLabel()).toBe("Row 1 column 3");
  });

  it("falls back to the first cell when the word is already full", async () => {
    localStorage.setItem(
      "oc:solve:slug",
      JSON.stringify({ "0,0": "C", "0,1": "A", "0,2": "T" }),
    );
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: /Feline/ }));
    expect(activeLabel()).toBe("Row 1 column 1");
  });
});

describe("SolveView typing", () => {
  beforeEach(() => localStorage.clear());

  // The press focuses the cell, which activates it — a first click must not be
  // mistaken for the second click that flips into the crossing word.
  it("clicking an unselected cell and typing advances along the same word", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByLabelText("Row 1 column 1"));
    await user.keyboard("c");
    expect(activeLabel()).toBe("Row 1 column 2");
  });

  // Row 2 column 1 is white only down the grid, so across would trap the cursor.
  it("typing in a cell with no across word moves along its down word", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByLabelText("Row 2 column 1"));
    await user.keyboard("o");
    expect(activeLabel()).toBe("Row 1 column 1");
  });

  it("clicking the selected cell still flips into the crossing word", async () => {
    const user = userEvent.setup();
    renderView();
    const cell = screen.getByLabelText("Row 1 column 1");
    await user.click(cell);
    await user.click(cell);
    await user.keyboard("c");
    expect(activeLabel()).toBe("Row 2 column 1");
  });
});
