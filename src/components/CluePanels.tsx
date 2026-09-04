"use client";

import { ClueList } from "./ClueList";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { PuzzleClue, PuzzleDTO } from "@/lib/puzzles";
import type { Direction } from "@/lib/crossword/types";
import type { Messages } from "@/lib/i18n";

export function CluePanels({
  puzzle,
  messages,
  direction,
  activeNumber,
  onSelectClue,
}: {
  puzzle: PuzzleDTO;
  messages: Messages;
  direction: Direction;
  activeNumber: number | null;
  onSelectClue: (clue: PuzzleClue, dir: Direction) => void;
}) {
  const panels = (
    [
      ["across", messages.clues.across, puzzle.clues.across],
      ["down", messages.clues.down, puzzle.clues.down],
    ] as const
  ).map(([dir, label, clues]) => (
    <Card key={dir} className="flex max-h-[70vh] min-h-64 flex-col overflow-hidden py-0">
      <CardHeader className="bg-muted/40 py-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <Separator />
      <ScrollArea className="flex-1">
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      {panels}
    </div>
  );
}
