import type { CSSProperties } from "react";
import type { PuzzleDTO, PuzzleClue } from "@/lib/puzzles";
import type { Cell } from "@/lib/crossword/types";
import type { Messages } from "@/lib/i18n";
import { CLUE_GUTTER_MM, sheetLayout, type SheetLayout } from "@/lib/print-layout";

/** Text a clue occupies on the sheet, used both to measure and to render. */
function clueLine(c: PuzzleClue, withAnswer: boolean) {
  return `${c.number}. ${c.clue} (${c.length})${withAnswer ? ` — ${c.answer}` : ""}`;
}

function StaticGrid({
  grid,
  withAnswers,
}: {
  grid: Cell[][];
  withAnswers: boolean;
}) {
  const cols = grid[0]?.length ?? 0;
  return (
    <div
      className="xw-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, var(--xw-cell-size, 7mm))`,
      }}
    >
      {grid.flatMap((row, r) =>
        row.map((cell, c) => (
          <div
            key={`${r}-${c}`}
            className={`xw-cell${cell ? "" : " block"}`}
            style={{ lineHeight: "var(--xw-cell-size, 7mm)" }}
          >
            {cell?.number ? <span className="xw-num">{cell.number}</span> : null}
            {withAnswers && cell ? cell.solution : ""}
          </div>
        )),
      )}
    </div>
  );
}

function ClueColumns({
  puzzle,
  messages,
  withAnswers,
}: {
  puzzle: PuzzleDTO;
  messages: Messages;
  withAnswers: boolean;
}) {
  const section = (title: string, clues: PuzzleClue[]) => (
    <>
      <h3 className="print-clue-heading">{title}</h3>
      <ol>
        {clues.map((c) => (
          <li key={`${c.number}-${c.row}-${c.col}`}>
            {clueLine(c, withAnswers)}
          </li>
        ))}
      </ol>
    </>
  );
  return (
    <div className="print-clues">
      {section(messages.clues.across, puzzle.clues.across)}
      {section(messages.clues.down, puzzle.clues.down)}
    </div>
  );
}

/** One physical sheet: heading, grid, then the clue text filling what's left. */
function Sheet({
  layout,
  heading,
  puzzle,
  messages,
  withAnswers,
  breakAfter,
}: {
  layout: SheetLayout;
  heading: string;
  puzzle: PuzzleDTO;
  messages: Messages;
  withAnswers: boolean;
  breakAfter: boolean;
}) {
  return (
    <section
      className={`print-sheet${breakAfter ? " print-page" : ""}`}
      style={
        {
          "--xw-cell-size": `${layout.cellMm}mm`,
          "--print-sheet-w": `${layout.contentWidthMm}mm`,
          "--print-sheet-h": `${layout.contentHeightMm}mm`,
          "--print-clue-font": `${layout.clueFontPt}pt`,
          "--print-clue-cols": layout.clueColumns,
          "--print-clue-gutter": `${CLUE_GUTTER_MM}mm`,
          fontSize: `${layout.cellMm * 2.1}pt`,
        } as CSSProperties
      }
    >
      <h2 className="print-title">{heading}</h2>
      <StaticGrid grid={puzzle.grid} withAnswers={withAnswers} />
      <ClueColumns
        puzzle={puzzle}
        messages={messages}
        withAnswers={withAnswers}
      />
    </section>
  );
}

/**
 * Print-oriented view: a blank puzzle sheet on one page, optionally followed by
 * a filled-in answer key on a second. Each sheet is sized to the paper so its
 * grid and clues never spill onto an extra page.
 */
export function PrintableCrossword({
  puzzle,
  includeAnswers = true,
  messages,
}: {
  puzzle: PuzzleDTO;
  includeAnswers?: boolean;
  messages: Messages;
}) {
  const allClues = [...puzzle.clues.across, ...puzzle.clues.down];
  const geometry = {
    paperSize: puzzle.paperSize,
    orientation: puzzle.orientation,
    cols: puzzle.grid[0]?.length ?? 0,
    rows: puzzle.grid.length,
  };
  const puzzleLayout = sheetLayout({
    ...geometry,
    clues: allClues.map((c) => ({ length: clueLine(c, false).length })),
  });
  const answerLayout = sheetLayout({
    ...geometry,
    clues: allClues.map((c) => ({ length: clueLine(c, true).length })),
  });

  return (
    <div className="printable">
      <style>{`@page { size: ${puzzleLayout.pageCss}; margin: 12mm; }`}</style>

      <Sheet
        layout={puzzleLayout}
        heading={puzzle.title}
        puzzle={puzzle}
        messages={messages}
        withAnswers={false}
        breakAfter={includeAnswers}
      />

      {includeAnswers && (
        <Sheet
          layout={answerLayout}
          heading={`${puzzle.title} — ${messages.print.answerKeySuffix}`}
          puzzle={puzzle}
          messages={messages}
          withAnswers
          breakAfter={false}
        />
      )}
    </div>
  );
}
