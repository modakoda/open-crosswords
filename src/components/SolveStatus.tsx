"use client";

import { TrophyIcon } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatMessage, type Messages } from "@/lib/i18n";

export function SolveStatus({
  t,
  pct,
  filledCells,
  totalCells,
  status,
}: {
  t: Messages["solve"];
  pct: number;
  filledCells: number;
  totalCells: number;
  status: "idle" | "solved" | "errors";
}) {
  return (
    <>
      <div className="no-print flex items-center gap-3">
        <Progress value={pct} className="h-2 max-w-xs" />
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatMessage(t.cellsFilled, { filled: filledCells, total: totalCells })}
        </span>
      </div>

      {status === "solved" && (
        <Alert className="no-print border-emerald-500/40 text-emerald-700 dark:text-emerald-400 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400">
          <TrophyIcon />
          <AlertTitle>{t.solved}</AlertTitle>
          <AlertDescription className="text-emerald-700/80 dark:text-emerald-400/80">
            {t.solvedNote}
          </AlertDescription>
        </Alert>
      )}
      {status === "errors" && (
        <Alert variant="destructive" className="no-print">
          <AlertTitle>{t.hasErrors}</AlertTitle>
        </Alert>
      )}
    </>
  );
}
