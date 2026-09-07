"use client";

import { useState } from "react";

/**
 * Checkbox selection over the rows a table is currently showing.
 *
 * The selection is dropped whenever the visible ids change — paging, filtering
 * or a reload that returns different rows — so a bulk action can never reach a
 * row the admin can no longer see.
 */
export function useRowSelection(ids: string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const key = ids.join(",");
  const [lastKey, setLastKey] = useState(key);

  if (lastKey !== key) {
    setLastKey(key);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }

  return {
    selected,
    /** Selection in the table's own order, so a confirmation can list it. */
    selectedIds: ids.filter((id) => selected.has(id)),
    allSelected: ids.length > 0 && selected.size === ids.length,
    toggle,
    toggleAll,
    clear: () => setSelected(new Set()),
  };
}
