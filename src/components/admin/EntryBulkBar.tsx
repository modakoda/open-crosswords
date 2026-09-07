"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";

import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Actions over the rows an admin has ticked. Deleting always goes through the
 * confirmation dialog first — the batch is irreversible and, unlike a single
 * row action, it can carry rows the admin ticked several scrolls ago, so the
 * dialog restates how many are about to go.
 */
export function EntryBulkBar({
  ids,
  onDeleted,
  onClear,
}: {
  ids: string[];
  onDeleted: () => void;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (ids.length === 0) return null;

  async function confirmDelete() {
    setBusy(true);
    try {
      const { deleted } = await orpc.admin.entries.deleteMany({ ids });
      toast.success(`Deleted ${deleted} ${deleted === 1 ? "entry" : "entries"}`);
      setConfirming(false);
      onClear();
      onDeleted();
    } catch {
      toast.error("Failed to delete the selected entries");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium">
        {ids.length} selected
      </span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="ml-auto"
        onClick={() => setConfirming(true)}
      >
        <Trash2Icon />
        Delete selected
      </Button>

      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {ids.length} {ids.length === 1 ? "entry" : "entries"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The selected entries will be removed from the question library. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                // Keep the dialog up while the request is in flight, so a slow
                // delete can't be fired twice from a closed-looking dialog.
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
