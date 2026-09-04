"use client";

import { useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";

import type { Category } from "./AdminDashboard";
import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export interface Entry {
  id: string;
  clue: string;
  answer: string;
  answerNormalized: string;
  difficulty: number;
  enabled: number;
  categoryId: string | null;
  timesUsed: number;
}

const DIFF_TONE = [
  "",
  "text-emerald-600 dark:text-emerald-400",
  "text-lime-600 dark:text-lime-400",
  "text-amber-600 dark:text-amber-400",
  "text-orange-600 dark:text-orange-400",
  "text-red-600 dark:text-red-400",
];

export function EntryTable({
  rows,
  q,
  categories,
  onChanged,
}: {
  rows: Entry[];
  q: string;
  categories: Category[];
  onChanged: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);

  async function toggle(entry: Entry) {
    await orpc.admin.entries.update({ id: entry.id, patch: { enabled: entry.enabled === 0 } });
    onChanged();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await orpc.admin.entries.delete({ id: pendingDelete.id });
    setPendingDelete(null);
    onChanged();
  }

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Clue</TableHead>
              <TableHead>Answer</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-center">Diff</TableHead>
              <TableHead className="text-center">Used</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No entries {q ? "match your search" : "yet"}.
                </TableCell>
              </TableRow>
            )}
            {rows.map((e) => (
              <TableRow key={e.id} data-disabled={!e.enabled}>
                <TableCell className="max-w-sm whitespace-normal">{e.clue}</TableCell>
                <TableCell className="font-mono text-xs">{e.answerNormalized}</TableCell>
                <TableCell className="text-muted-foreground">{catName(e.categoryId)}</TableCell>
                <TableCell
                  className={`text-center font-semibold tabular-nums ${DIFF_TONE[e.difficulty] ?? ""}`}
                >
                  {e.difficulty}
                </TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {e.timesUsed}
                </TableCell>
                <TableCell className="text-center">
                  {e.enabled ? (
                    <Badge variant="secondary">On</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Off
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toggle(e)}>
                        {e.enabled ? "Disable" : "Enable"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(e)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.clue} — {pendingDelete?.answerNormalized}. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
