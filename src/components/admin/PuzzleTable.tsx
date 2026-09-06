"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontalIcon } from "lucide-react";

import { PuzzleRenameDialog } from "./PuzzleRenameDialog";
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

export interface Puzzle {
  id: string;
  slug: string;
  title: string;
  languageCode: string;
  paperSize: string;
  orientation: string;
  width: number;
  height: number;
  wordCount: number;
  ownerEmail: string | null;
  createdAt: string;
}

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function PuzzleTable({
  rows,
  q,
  onChanged,
}: {
  rows: Puzzle[];
  q: string;
  onChanged: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<Puzzle | null>(null);
  const [renaming, setRenaming] = useState<Puzzle | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    await orpc.admin.puzzles.delete({ id: pendingDelete.id });
    setPendingDelete(null);
    onChanged();
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Lang</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Link</TableHead>
              <TableHead className="text-center">Grid</TableHead>
              <TableHead className="text-center">Words</TableHead>
              <TableHead>Paper</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  No puzzles {q ? "match your search" : "yet"}.
                </TableCell>
              </TableRow>
            )}
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs uppercase">
                    {p.languageCode}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs whitespace-normal">{p.title}</TableCell>
                <TableCell>
                  <Link
                    href={`/public/puzzles/${p.slug}`}
                    target="_blank"
                    className="font-mono text-xs underline underline-offset-2"
                  >
                    {p.slug}
                  </Link>
                </TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {p.width}×{p.height}
                </TableCell>
                <TableCell className="text-center tabular-nums">{p.wordCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.paperSize.toUpperCase()} {p.orientation}
                </TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">
                  {p.ownerEmail ?? "Anonymous"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {dateFormat.format(new Date(p.createdAt))}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/public/puzzles/${p.slug}`} target="_blank">
                          Open
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/public/puzzles/${p.slug}/print`} target="_blank">
                          Print view
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRenaming(p)}>Rename</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(p)}>
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

      <PuzzleRenameDialog
        puzzle={renaming}
        onClose={() => setRenaming(null)}
        onRenamed={onChanged}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this puzzle?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.title} ({pendingDelete?.slug}). Its shared link and any saved
              solve progress go with it. This can&apos;t be undone.
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
