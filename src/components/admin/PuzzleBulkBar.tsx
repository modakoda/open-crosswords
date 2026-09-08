"use client";

import { BulkDeleteBar } from "./BulkDeleteBar";
import { orpc } from "@/lib/orpc/client";

/** The puzzles listing's batch actions. */
export function PuzzleBulkBar({
  ids,
  onDeleted,
  onClear,
}: {
  ids: string[];
  onDeleted: () => void;
  onClear: () => void;
}) {
  return (
    <BulkDeleteBar
      ids={ids}
      noun="puzzle"
      plural="puzzles"
      description="The selected puzzles go for good, along with their shared links and any saved solve progress. This can't be undone."
      deleteMany={(batch) => orpc.admin.puzzles.deleteMany({ ids: batch })}
      onDeleted={onDeleted}
      onClear={onClear}
    />
  );
}
