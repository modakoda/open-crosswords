"use client";

import { ClueList } from "./ClueList";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { PuzzleClue, PuzzleDTO } from "@/lib/puzzles";
import type { Direction } from "@/lib/crossword/types";
import type { Messages } from "@/lib/i18n";

export function CluePanels({
  puzzle,
  messages,
  direction,
  activeNumber,
  onSelectClue,
  className,
}: {
  puzzle: PuzzleDTO;
  messages: Messages;
  direction: Direction;
  activeNumber: number | null;
  onSelectClue: (clue: PuzzleClue, dir: Direction) => void;
  className?: string;
}) {
  const panels = (
    [
      ["across", messages.clues.across, puzzle.clues.across],
      ["down", messages.clues.down, puzzle.clues.down],
    ] as const
  ).map(([dir, label, clues]) => (
    <Card
      key={dir}
      data-direction={dir}
      className={cn(
        "flex max-h-[65vh] min-h-56 min-w-0 flex-col gap-0 overflow-hidden py-0 lg:max-h-none",
        // Whichever direction is being solved leads the stack, so its clues are
        // the ones in view. Only while the panels are stacked — side by side
        // (sm..lg) reordering would just swap the columns around.
        direction === dir && "order-first sm:order-none lg:order-first",
      )}
    >
      <CardHeader className="bg-primary/5 py-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <ClueList
          className="p-2"
          hideHeading
          title={label}
          clues={clues}
          activeNumber={direction === dir ? activeNumber : null}
          onSelect={(c) => onSelectClue(c, dir)}
        />
      </ScrollArea>
    </Card>
  ));

  return (
    // Side by side once there's room for two readable columns. Below that they
    // stack and scroll internally (the grid is right above them); beside the
    // grid on the wide layout they stack and flow with the page instead, so
    // there's no scrollbar inside a scrollbar.
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1", className)}>
      {panels}
    </div>
  );
}
