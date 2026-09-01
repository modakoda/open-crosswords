import type { CSSProperties } from "react";
import type { PuzzleDTO } from "@/lib/puzzles";
import type { Cell } from "@/lib/crossword/types";
import { ClueList } from "./ClueList";

const PAGE_CSS: Record<string, string> = {
  a4: "210mm 297mm",
  a5: "148mm 210mm",
  letter: "8.5in 11in",
  legal: "8.5in 14in",
};

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

/**
 * Print-oriented view: a blank puzzle sheet, optionally followed by a filled-in
 * answer key. Pass `includeAnswers={false}` to print the puzzle only.
 */
export function PrintableCrossword({
  puzzle,
  includeAnswers = true,
}: {
  puzzle: PuzzleDTO;
  includeAnswers?: boolean;
}) {
  const size = PAGE_CSS[puzzle.paperSize] ?? PAGE_CSS.a4;
  return (
    <div
      className="printable"
      style={{ "--xw-cell-size": "7mm" } as CSSProperties}
    >
      <style>{`@page { size: ${size} ${puzzle.orientation}; margin: 14mm; }`}</style>

      <section className={includeAnswers ? "print-page" : undefined}>
        <h1 className="mb-3 text-xl font-bold">{puzzle.title}</h1>
        <StaticGrid grid={puzzle.grid} withAnswers={false} />
        <div className="mt-4 grid grid-cols-2 gap-6">
          <ClueList title="Across" clues={puzzle.clues.across} />
          <ClueList title="Down" clues={puzzle.clues.down} />
        </div>
      </section>

      {includeAnswers && (
        <section>
          <h2 className="mb-3 text-lg font-bold">{puzzle.title} — Answer key</h2>
          <StaticGrid grid={puzzle.grid} withAnswers />
          <div className="mt-4 grid grid-cols-2 gap-6">
            <ClueList title="Across" clues={puzzle.clues.across} showAnswers />
            <ClueList title="Down" clues={puzzle.clues.down} showAnswers />
          </div>
        </section>
      )}
    </div>
  );
}
