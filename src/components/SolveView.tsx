"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PuzzleClue, PuzzleDTO } from "@/lib/puzzles";
import type { Direction } from "@/lib/crossword/types";
import { CrosswordGrid } from "./CrosswordGrid";
import { ClueList } from "./ClueList";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";

const cellKey = (r: number, c: number) => `${r},${c}`;

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Button variant="outline" onClick={check}>
          {t.check}
        </Button>
        <Button variant="outline" onClick={revealWord}>
          {t.revealWord}
        </Button>
        <Button variant="outline" onClick={clearAll}>
          {t.clear}
        </Button>
        <Button variant="outline" asChild>
          <a href={`/puzzles/${puzzle.slug}/print`}>{t.printVersion}</a>
        </Button>
        {status === "solved" && (
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            {t.solved}
          </span>
        )}
        {status === "errors" && (
          <span className="font-semibold text-destructive">{t.hasErrors}</span>
        )}
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="overflow-auto">
          <CrosswordGrid
            grid={puzzle.grid}
            values={values}
            wrong={wrong}
            active={active}
            direction={direction}
            onChange={setLetter}
            onActivate={activate}
          />
        </div>
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <ClueList
            title={messages.clues.across}
            clues={puzzle.clues.across}
            activeNumber={direction === "across" ? activeNumber : null}
            onSelect={(c) => selectClue(c, "across")}
          />
          <ClueList
            title={messages.clues.down}
            clues={puzzle.clues.down}
            activeNumber={direction === "down" ? activeNumber : null}
            onSelect={(c) => selectClue(c, "down")}
          />
        </div>
      </div>
    </div>
  );
}
