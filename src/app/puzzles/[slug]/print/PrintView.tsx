"use client";

import { useState } from "react";
import type { PuzzleDTO } from "@/lib/puzzles";
import { PrintableCrossword } from "@/components/PrintableCrossword";

/** Print screen: lets the reader choose whether to include the answer key. */
export function PrintView({ puzzle }: { puzzle: PuzzleDTO }) {
  const [includeAnswers, setIncludeAnswers] = useState(true);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <button className="btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <a className="btn" href={`/puzzles/${puzzle.slug}`}>
          Back to online solver
        </a>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeAnswers}
            onChange={(e) => setIncludeAnswers(e.target.checked)}
          />
          Include solved answer key
        </label>
        <span className="text-sm text-slate-500">
          {includeAnswers
            ? "Page 1 is the puzzle, page 2 is the answer key."
            : "Puzzle only — no answers printed."}
        </span>
      </div>
      <PrintableCrossword puzzle={puzzle} includeAnswers={includeAnswers} />
    </div>
  );
}
