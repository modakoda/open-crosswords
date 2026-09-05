"use client";

import { cn } from "@/lib/utils";
import type { PuzzleClue } from "@/lib/puzzles";
import type { Direction } from "@/lib/crossword/types";
import type { Messages } from "@/lib/i18n";

/**
 * The clue for the cell being edited, shown next to the grid. On narrow
 * layouts the clue lists sit below the grid, too far to read while typing.
 */
export function ActiveClue({
  clue,
  direction,
  messages,
  className,
}: {
  clue: PuzzleClue | null;
  direction: Direction;
  messages: Messages;
  className?: string;
}) {
  if (!clue) return null;
  const label = direction === "across" ? messages.clues.across : messages.clues.down;
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex min-w-0 items-baseline gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm",
        className,
      )}
    >
      <span className="shrink-0 font-semibold tabular-nums">{clue.number}</span>
      <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0">
        {clue.clue} <span className="text-muted-foreground">({clue.length})</span>
      </span>
    </div>
  );
}
