import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrosswordGrid } from "./CrosswordGrid";
import type { Cell } from "@/lib/crossword/types";

// 1x3 across word, all white
const grid: Cell[][] = [
  [
    { solution: "C", number: 1 },
    { solution: "A" },
    { solution: "T" },
  ],
];

function setup(values: Record<string, string> = {}) {
  const onChange = vi.fn();
  const onActivate = vi.fn();
  render(
    <CrosswordGrid
      grid={grid}
      values={values}
      wrong={new Set()}
      active="0,0"
      direction="across"
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
