"use client";

import { useState } from "react";
import type { PuzzleDTO } from "@/lib/puzzles";
import { PrintableCrossword } from "@/components/PrintableCrossword";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** Print screen: lets the reader choose whether to include the answer key. */
export function PrintView({ puzzle }: { puzzle: PuzzleDTO }) {
  const [includeAnswers, setIncludeAnswers] = useState(true);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Button onClick={() => window.print()}>Print / Save as PDF</Button>
        <Button variant="outline" asChild>
          <a href={`/puzzles/${puzzle.slug}`}>Back to online solver</a>
        </Button>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={includeAnswers}
            onCheckedChange={(checked) => setIncludeAnswers(checked === true)}
          />
          Include solved answer key
        </Label>
        <span className="text-sm text-muted-foreground">
          {includeAnswers
            ? "Page 1 is the puzzle, page 2 is the answer key."
            : "Puzzle only — no answers printed."}
        </span>
      </div>
      <PrintableCrossword puzzle={puzzle} includeAnswers={includeAnswers} />
    </div>
  );
}
