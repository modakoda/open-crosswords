"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";

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
 * Actions over the rows an admin has ticked, shared by every listing that
 * offers a batch delete. Deleting always goes through the confirmation dialog
 * first — the batch is irreversible and, unlike a single row action, it can
 * carry rows the admin ticked several scrolls ago, so the dialog restates how
 * many are about to go.
 */
export function BulkDeleteBar({
  ids,
  noun,
  plural,
  description,
  deleteMany,
  onDeleted,
  onClear,
}: {
  ids: string[];
  /** What one row is, for the dialog title and the toast. */
  noun: string;
  plural: string;
  description: ReactNode;
  deleteMany: (ids: string[]) => Promise<{ deleted: number }>;
  onDeleted: () => void;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (ids.length === 0) return null;

  async function confirmDelete() {
    setBusy(true);
    try {
      const { deleted } = await deleteMany(ids);
      toast.success(`Deleted ${deleted} ${deleted === 1 ? noun : plural}`);
      setConfirming(false);
      onClear();
      onDeleted();
    } catch {
      toast.error(`Failed to delete the selected ${plural}`);
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
              Delete {ids.length} {ids.length === 1 ? noun : plural}?
            </AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
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
