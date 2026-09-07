"use client";

import { useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { LanguageRenameDialog } from "./LanguageRenameDialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface LanguageRow {
  code: string;
  name: string;
  entryCount: number;
  categoryCount: number;
  puzzleCount: number;
}

/**
 * A language can only be dropped while nothing the library would lose is filed
 * under it. Categories are not in that list — they cascade, and one with no
 * entries left in it is just a label — so they only warrant a warning in the
 * confirmation. The server re-checks all of this; hiding the button is a
 * courtesy, not the guard.
 */
export function isRemovable(row: LanguageRow) {
  return row.entryCount === 0 && row.puzzleCount === 0;
}

/**
 * One row per content language, with what is filed under it. The counts are
 * the reason this listing exists: they are what separates a code the library
 * depends on from one added by mistake — and what decides whether the mistake
 * can still be removed.
 */
export function LanguageTable({
  rows,
  onChanged,
  onError,
}: {
  rows: LanguageRow[];
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [renaming, setRenaming] = useState<LanguageRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LanguageRow | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { code } = pendingDelete;
    setPendingDelete(null);
    try {
      await orpc.admin.languages.delete({ code });
    } catch {
      // Most often the listing is stale and something has been filed under it
      // since it was loaded — refreshing below is what shows that.
      onError(`Could not remove ${code}. It may no longer be empty.`);
    }
    onChanged();
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Language</TableHead>
            <TableHead>Code</TableHead>
            <TableHead className="text-right">Entries</TableHead>
            <TableHead className="text-right">Categories</TableHead>
            <TableHead className="text-right">Puzzles</TableHead>
            <TableHead className="w-44" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No languages yet. Add one above to start filling the library.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.code}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="font-mono text-muted-foreground">
                {row.code}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.entryCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.categoryCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.puzzleCount}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRenaming(row)}
                  aria-label={`Rename ${row.name}`}
                >
                  <PencilIcon />
                  Rename
                </Button>
                {isRemovable(row) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDelete(row)}
                    aria-label={`Remove ${row.name}`}
                  >
                    <Trash2Icon />
                    Remove
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <LanguageRenameDialog
        language={renaming}
        onClose={() => setRenaming(null)}
        onRenamed={onChanged}
      />
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this language?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} ({pendingDelete?.code}) has no entries and no
              puzzles.
              {pendingDelete && pendingDelete.categoryCount > 0
                ? ` Its ${pendingDelete.categoryCount} empty ${
                    pendingDelete.categoryCount === 1 ? "category" : "categories"
                  } go with it.`
                : ""}{" "}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
