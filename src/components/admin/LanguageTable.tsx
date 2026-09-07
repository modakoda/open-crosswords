"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";

import { LanguageRenameDialog } from "./LanguageRenameDialog";
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

export interface LanguageRow {
  code: string;
  name: string;
  entryCount: number;
  categoryCount: number;
  puzzleCount: number;
}

/**
 * One row per content language, with what is filed under it. The counts are
 * the reason this listing exists: they are what separates a code the library
 * depends on from one added by mistake.
 */
export function LanguageTable({
  rows,
  language,
  onLanguageChange,
  onChanged,
}: {
  rows: LanguageRow[];
  /** The dashboard's working language, badged so it is visible here too. */
  language: string;
  onLanguageChange: (code: string) => void;
  onChanged: () => void;
}) {
  const [renaming, setRenaming] = useState<LanguageRow | null>(null);

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
            <TableHead className="w-40" />
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
              <TableCell className="font-medium">
                {row.name}
                {row.code === language && (
                  <Badge variant="outline" className="ml-2 font-normal">
                    Working
                  </Badge>
                )}
              </TableCell>
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
                {row.code !== language && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onLanguageChange(row.code)}
                  >
                    Use
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
    </>
  );
}
