"use client";

import { useState } from "react";
import type { PuzzleDTO } from "@/lib/puzzles";
import { PrintableCrossword } from "@/components/PrintableCrossword";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";

/** Print screen: lets the reader choose whether to include the answer key. */
export function PrintView({
  puzzle,
  messages,
}: {
  puzzle: PuzzleDTO;
  messages: Messages;
}) {
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const t = messages.print;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Button onClick={() => window.print()}>{t.printSave}</Button>
        <Button variant="outline" asChild>
          <a href={`/puzzles/${puzzle.slug}`}>{t.backToSolver}</a>
        </Button>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={includeAnswers}
            onCheckedChange={(checked) => setIncludeAnswers(checked === true)}
          />
          {t.includeAnswerKey}
        </Label>
        <span className="text-sm text-muted-foreground">
          {includeAnswers ? t.withAnswersNote : t.withoutAnswersNote}
        </span>
      </div>
      <PrintableCrossword
        puzzle={puzzle}
        includeAnswers={includeAnswers}
        messages={messages}
      />
    </div>
  );
}
