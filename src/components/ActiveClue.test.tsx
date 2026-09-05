import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ActiveClue } from "./ActiveClue";
import { getMessages } from "@/lib/i18n";
import type { PuzzleClue } from "@/lib/puzzles";

const messages = getMessages("en");
const clue: PuzzleClue = {
  number: 4,
  clue: "Portable computer",
  answer: "LAPTOP",
  length: 6,
  row: 2,
  col: 3,
};

describe("ActiveClue", () => {
  it("shows the number, direction and clue with its length", () => {
    render(<ActiveClue clue={clue} direction="across" messages={messages} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(messages.clues.across)).toBeInTheDocument();
    expect(screen.getByText(/Portable computer/)).toBeInTheDocument();
    expect(screen.getByText("(6)")).toBeInTheDocument();
  });

  it("labels the down direction when solving down", () => {
    render(<ActiveClue clue={clue} direction="down" messages={messages} />);
    expect(screen.getByText(messages.clues.down)).toBeInTheDocument();
  });

  it("renders nothing without an active clue", () => {
    const { container } = render(
      <ActiveClue clue={null} direction="across" messages={messages} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
