"use client";

import { BulkDeleteBar } from "./BulkDeleteBar";
import { orpc } from "@/lib/orpc/client";

/** The entries listing's batch actions. */
export function EntryBulkBar({
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
      noun="entry"
      plural="entries"
      description="The selected entries will be removed from the question library. This can't be undone."
      deleteMany={(batch) => orpc.admin.entries.deleteMany({ ids: batch })}
      onDeleted={onDeleted}
      onClear={onClear}
    />
  );
}
