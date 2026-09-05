import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrosswordGrid } from "./CrosswordGrid";
import type { Cell, Direction } from "@/lib/crossword/types";

// 1x3 across word, all white
const grid: Cell[][] = [
  [
    { solution: "C", number: 1 },
    { solution: "A" },
    { solution: "T" },
  ],
];

function setup(
  values: Record<string, string> = {},
  cells: Cell[][] = grid,
  active: string | null = "0,0",
  direction: Direction = "across",
) {
  const onChange = vi.fn();
  const onActivate = vi.fn();
  render(
    <CrosswordGrid
      grid={cells}
      values={values}
      wrong={new Set()}
      active={active}
      direction={direction}
      onChange={onChange}
      onActivate={onActivate}
    />,
  );
  return { onChange, onActivate };
}

describe("CrosswordGrid", () => {
  it("renders one input per white cell", () => {
    setup();
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
  });

  it("typing a letter reports it uppercased for the focused cell", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    const first = screen.getByLabelText("Row 1 column 1");
    first.focus();
    await user.keyboard("a");
    expect(onChange).toHaveBeenCalledWith(0, 0, "A");
  });

  it("Backspace on a filled cell clears it", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ "0,0": "C" });
    screen.getByLabelText("Row 1 column 1").focus();
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenCalledWith(0, 0, "");
  });

  it("ArrowDown switches the active direction to down", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup();
    screen.getByLabelText("Row 1 column 1").focus();
    await user.keyboard("{ArrowDown}");
    expect(onActivate).toHaveBeenCalledWith(0, 0, "down");
  });

  it("typing skips over cells the word already has filled", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({ "0,1": "A" });
    screen.getByLabelText("Row 1 column 1").focus();
    await user.keyboard("c");
    expect(onActivate).toHaveBeenLastCalledWith(0, 2, "across");
  });

  it("wraps back to the first empty cell of the same word", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({ "0,2": "T" }, grid, "0,1");
    screen.getByLabelText("Row 1 column 2").focus();
    await user.keyboard("a");
    expect(onActivate).toHaveBeenLastCalledWith(0, 0, "across");
  });

  it("stays on the last cell once the word is completely filled", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup(
      { "0,0": "C", "0,1": "A", "0,2": "T" },
      grid,
      "0,2",
    );
    screen.getByLabelText("Row 1 column 3").focus();
    await user.keyboard("t");
    expect(onActivate).toHaveBeenLastCalledWith(0, 2, "across");
  });

  it("never advances into the next word across a block", async () => {
    const user = userEvent.setup();
    const withBlock: Cell[][] = [
      [
        { solution: "C", number: 1 },
        { solution: "A" },
        { solution: "T" },
        null,
        { solution: "D", number: 2 },
      ],
    ];
    const { onActivate } = setup(
      { "0,0": "C", "0,1": "A", "0,2": "T" },
      withBlock,
      "0,2",
    );
    screen.getByLabelText("Row 1 column 3").focus();
    await user.keyboard("t");
    expect(onActivate).not.toHaveBeenCalledWith(0, 4, "across");
  });

  it("Backspace on an empty cell does not step past the start of the word", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({}, grid, "0,0");
    screen.getByLabelText("Row 1 column 1").focus();
    onActivate.mockClear();
    await user.keyboard("{Backspace}");
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("Space moves to the first cell of the crossing word", async () => {
    const user = userEvent.setup();
    // 3x1 down word crossed by the across word in row 3.
    const cross: Cell[][] = [
      [{ solution: "C", number: 1 }],
      [{ solution: "A" }],
      [{ solution: "T" }],
    ];
    const { onActivate } = setup({}, cross, "2,0");
    screen.getByLabelText("Row 3 column 1").focus();
    await user.keyboard(" ");
    expect(onActivate).toHaveBeenLastCalledWith(0, 0, "down");
  });

  it("clicking the active cell switches direction and goes to that word's start", async () => {
    const user = userEvent.setup();
    const cross: Cell[][] = [
      [{ solution: "C", number: 1 }],
      [{ solution: "A" }],
      [{ solution: "T" }],
    ];
    const { onActivate } = setup({}, cross, "2,0");
    await user.click(screen.getByLabelText("Row 3 column 1"));
    expect(onActivate).toHaveBeenLastCalledWith(0, 0, "down");
  });

  // An unchecked square: white in only one direction, like the top of a down
  // word poking above the across word it starts.
  const unchecked: Cell[][] = [
    [null, { solution: "D", number: 1 }, null],
    [{ solution: "S", number: 2 }, { solution: "D" }, { solution: "F" }],
    [null, { solution: "O" }, null],
  ];

  it("clicking a cell with no word across selects it down instead", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({}, unchecked, null);
    await user.click(screen.getByLabelText("Row 1 column 2"));
    expect(onActivate).toHaveBeenLastCalledWith(0, 1, "down");
  });

  it("clicking the active cell does not switch into a one-cell word", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({}, unchecked, "0,1", "down");
    await user.click(screen.getByLabelText("Row 1 column 2"));
    expect(onActivate).toHaveBeenLastCalledWith(0, 1, "down");
  });

  it("Space does not switch into a one-cell word", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({}, unchecked, "1,0", "across");
    screen.getByLabelText("Row 2 column 1").focus();
    onActivate.mockClear();
    await user.keyboard(" ");
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("clicking a cell that is not active keeps that exact cell", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({}, grid, "0,0");
    await user.click(screen.getByLabelText("Row 1 column 3"));
    expect(onActivate).toHaveBeenLastCalledWith(0, 2, "across");
  });

  it("switching direction skips letters the crossing word already has", async () => {
    const user = userEvent.setup();
    const cross: Cell[][] = [
      [{ solution: "C", number: 1 }],
      [{ solution: "A" }],
      [{ solution: "T" }],
    ];
    const { onActivate } = setup({ "0,0": "C" }, cross, "2,0");
    screen.getByLabelText("Row 3 column 1").focus();
    await user.keyboard(" ");
    expect(onActivate).toHaveBeenLastCalledWith(1, 0, "down");
  });

  it("switching direction into a full word falls back to its first cell", async () => {
    const user = userEvent.setup();
    const cross: Cell[][] = [
      [{ solution: "C", number: 1 }],
      [{ solution: "A" }],
      [{ solution: "T" }],
    ];
    const { onActivate } = setup(
      { "0,0": "C", "1,0": "A", "2,0": "T" },
      cross,
      "2,0",
    );
    screen.getByLabelText("Row 3 column 1").focus();
    await user.keyboard(" ");
    expect(onActivate).toHaveBeenLastCalledWith(0, 0, "down");
  });

  // Two across words with a blank row between them, so no down words exist.
  const twoWords: Cell[][] = [
    [{ solution: "C", number: 1 }, { solution: "A" }, { solution: "T" }],
    [null, null, null],
    [{ solution: "D", number: 2 }, { solution: "O" }, { solution: "G" }],
  ];

  it("Tab moves to the start of the next word", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({}, twoWords, "0,1");
    screen.getByLabelText("Row 1 column 2").focus();
    await user.keyboard("{Tab}");
    expect(onActivate).toHaveBeenLastCalledWith(2, 0, "across");
  });

  it("Tab skips cells the next word already has filled", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({ "2,0": "D" }, twoWords, "0,0");
    screen.getByLabelText("Row 1 column 1").focus();
    await user.keyboard("{Tab}");
    expect(onActivate).toHaveBeenLastCalledWith(2, 1, "across");
  });

  it("Tab wraps around from the last word to the first", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({}, twoWords, "2,0");
    screen.getByLabelText("Row 3 column 1").focus();
    await user.keyboard("{Tab}");
    expect(onActivate).toHaveBeenLastCalledWith(0, 0, "across");
  });

  it("Shift+Tab moves to the previous word", async () => {
    const user = userEvent.setup();
    const { onActivate } = setup({}, twoWords, "0,0");
    screen.getByLabelText("Row 1 column 1").focus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(onActivate).toHaveBeenLastCalledWith(2, 0, "across");
  });

  it("Tab crosses into the down words once the across ones run out", async () => {
    const user = userEvent.setup();
    // Single across word whose cells also start 2-letter down words.
    const cells: Cell[][] = [
      [{ solution: "C", number: 1 }, { solution: "A", number: 2 }],
      [{ solution: "O" }, { solution: "T" }],
    ];
    const { onActivate } = setup({}, cells, "1,0");
    screen.getByLabelText("Row 2 column 1").focus();
    await user.keyboard("{Tab}");
    expect(onActivate).toHaveBeenLastCalledWith(0, 0, "down");
  });

  it("sizes itself from the column count so it fits its container", () => {
    setup();
    const grid = document.querySelector(".xw-grid");
    expect(grid).toHaveClass("xw-grid--fluid");
    expect(grid).toHaveStyle({ "--xw-cols": "3" });
  });

  it("marks wrong cells", () => {
    const onChange = vi.fn();
    render(
      <CrosswordGrid
        grid={grid}
        values={{ "0,0": "X" }}
        wrong={new Set(["0,0"])}
        active={null}
        direction="across"
        onChange={onChange}
        onActivate={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText("Row 1 column 1").closest(".xw-cell"),
    ).toHaveClass("wrong");
  });
});
