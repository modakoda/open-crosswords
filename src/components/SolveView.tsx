"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  KeyboardIcon,
  PrinterIcon,
  RotateCcwIcon,
  Share2Icon,
  TrophyIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { PuzzleClue, PuzzleDTO } from "@/lib/puzzles";
import type { Direction } from "@/lib/crossword/types";
import { formatMessage, type Messages } from "@/lib/i18n";
import { CrosswordGrid } from "./CrosswordGrid";
import { ClueList } from "./ClueList";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

const cellKey = (r: number, c: number) => `${r},${c}`;
const currentUrl = () =>
  typeof window === "undefined" ? "" : window.location.href;

export function SolveView({
  puzzle,
  messages,
}: {
  puzzle: PuzzleDTO;
  messages: Messages;
}) {
  const t = messages.solve;
  const storageKey = `oc:solve:${puzzle.slug}`;
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("across");
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "solved" | "errors">("idle");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setValues(JSON.parse(raw));
    } catch {
      /* ignore unreadable storage */
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: Record<string, string>) => {
      setValues(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore quota/private-mode errors */
      }
    },
    [storageKey],
  );

  const solutionAt = useMemo(() => {
    const map = new Map<string, string>();
    puzzle.grid.forEach((row, r) =>
      row.forEach((cell, c) => cell && map.set(cellKey(r, c), cell.solution)),
    );
    return map;
  }, [puzzle.grid]);

  const totalCells = solutionAt.size;
  const filledCells = useMemo(
    () => [...solutionAt.keys()].filter((k) => values[k]).length,
    [solutionAt, values],
  );
  const pct = totalCells ? Math.round((filledCells / totalCells) * 100) : 0;

  function setLetter(r: number, c: number, letter: string) {
    const next = { ...values };
    if (letter) next[cellKey(r, c)] = letter;
    else delete next[cellKey(r, c)];
    persist(next);
    setStatus("idle");
    setWrong(new Set());
  }

  function activate(r: number, c: number, dir: Direction) {
    setActive(cellKey(r, c));
    setDirection(dir);
  }

  function selectClue(clue: PuzzleClue, dir: Direction) {
    setActive(cellKey(clue.row, clue.col));
    setDirection(dir);
  }

  function check() {
    const bad = new Set<string>();
    let filled = 0;
    let total = 0;
    for (const [k, sol] of solutionAt) {
      total++;
      const v = values[k];
      if (v) filled++;
      if (v && v !== sol) bad.add(k);
    }
    setWrong(bad);
    setStatus(bad.size === 0 && filled === total ? "solved" : "errors");
  }

  function revealWord() {
    if (!active) return;
    const [ar, ac] = active.split(",").map(Number);
    const dr = direction === "down" ? 1 : 0;
    const dc = direction === "across" ? 1 : 0;
    let r = ar;
    let c = ac;
    while (puzzle.grid[r - dr]?.[c - dc]) {
      r -= dr;
      c -= dc;
    }
    const next = { ...values };
    while (puzzle.grid[r]?.[c]) {
      next[cellKey(r, c)] = puzzle.grid[r][c]!.solution;
      r += dr;
      c += dc;
    }
    persist(next);
  }

  function clearAll() {
    persist({});
    setWrong(new Set());
    setStatus("idle");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(currentUrl());
      toast.success(t.linkCopied);
    } catch {
      /* clipboard unavailable — the field is selectable as a fallback */
    }
  }

  const activeNumber = useMemo(() => {
    if (!active) return null;
    const [r, c] = active.split(",").map(Number);
    const list = direction === "across" ? puzzle.clues.across : puzzle.clues.down;
    const dr = direction === "down" ? 1 : 0;
    const dc = direction === "across" ? 1 : 0;
    let sr = r;
    let sc = c;
    while (puzzle.grid[sr - dr]?.[sc - dc]) {
      sr -= dr;
      sc -= dc;
    }
    return list.find((cl) => cl.row === sr && cl.col === sc)?.number ?? null;
  }, [active, direction, puzzle]);

  const cluePanels = (
    [
      ["across", messages.clues.across, puzzle.clues.across],
      ["down", messages.clues.down, puzzle.clues.down],
    ] as const
  ).map(([dir, label, clues]) => (
    <Card
      key={dir}
      className="flex max-h-[70vh] min-h-64 flex-col overflow-hidden py-0"
    >
      <CardHeader className="bg-muted/40 py-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <Separator />
      <ScrollArea className="flex-1">
        <ClueList
          className="p-2"
          hideHeading
          title={label}
          clues={clues}
          activeNumber={direction === dir ? activeNumber : null}
          onSelect={(c) => selectClue(c, dir)}
        />
      </ScrollArea>
    </Card>
  ));

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={check}>
          <CheckIcon />
          {t.check}
        </Button>
        <Button variant="outline" size="sm" onClick={revealWord} disabled={!active}>
          <EyeIcon />
          {t.revealWord}
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Share2Icon />
              {t.share}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.shareTitle}</DialogTitle>
              <DialogDescription>{t.shareDescription}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                readOnly
                defaultValue={currentUrl()}
                onFocus={(e) => e.target.select()}
              />
              <Button onClick={copyLink}>
                <CopyIcon />
                {t.copyLink}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <RotateCcwIcon />
              {t.reset}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.resetTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.resetDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={clearAll}>
                {t.resetConfirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button variant="ghost" size="sm" asChild>
          <a href={`/public/puzzles/${puzzle.slug}/print`}>
            <PrinterIcon />
            {t.printVersion}
          </a>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t.keyboardHint}>
              <KeyboardIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.keyboardHint}</TooltipContent>
        </Tooltip>
      </div>

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

      <div className="grid gap-6 xl:grid-cols-[auto_minmax(20rem,1fr)] xl:items-start">
        <Card className="w-fit max-w-full overflow-auto p-3 sm:p-4">
          <CrosswordGrid
            grid={puzzle.grid}
            values={values}
            wrong={wrong}
            active={active}
            direction={direction}
            onChange={setLetter}
            onActivate={activate}
          />
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {cluePanels}
        </div>
      </div>
    </div>
  );
}
