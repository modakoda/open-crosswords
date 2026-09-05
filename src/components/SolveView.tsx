"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { PuzzleClue, PuzzleDTO } from "@/lib/puzzles";
import type { Direction } from "@/lib/crossword/types";
import type { Messages } from "@/lib/i18n";
import { CrosswordGrid } from "./CrosswordGrid";
import { SolveToolbar } from "./SolveToolbar";
import { SolveStatus } from "./SolveStatus";
import { CluePanels } from "./CluePanels";
import { ActiveClue } from "./ActiveClue";
import { Card } from "@/components/ui/card";
import { orpc } from "@/lib/orpc/client";
import { useSession } from "@/lib/auth-client";

const cellKey = (r: number, c: number) => `${r},${c}`;
const currentUrl = () => (typeof window === "undefined" ? "" : window.location.href);

export function SolveView({
  puzzle,
  messages,
}: {
  puzzle: PuzzleDTO;
  messages: Messages;
}) {
  const t = messages.solve;
  const storageKey = `oc:solve:${puzzle.slug}`;
  const { data: session } = useSession();
  const signedIn = !!session;
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("across");
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "solved" | "errors">("idle");
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setValues(JSON.parse(raw));
    } catch {
      /* ignore unreadable storage */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!signedIn) return;
    // Server state (synced across devices) takes precedence over this device's cache.
    orpc.client.solveState
      .get({ puzzleId: puzzle.id })
      .then((d) => {
        if (d.progress) setValues(d.progress);
      })
      .catch(() => {
        /* no server state yet, or the request failed — local cache stands */
      });
  }, [signedIn, puzzle.id]);

  const persist = useCallback(
    (next: Record<string, string>) => {
      setValues(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore quota/private-mode errors */
      }
      if (signedIn) {
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => {
          orpc.client.solveState
            .save({ puzzleId: puzzle.id, progress: next })
            .catch(() => {
              /* best-effort sync — local cache is still authoritative on this device */
            });
        }, 800);
      }
    },
    [storageKey, signedIn, puzzle.id],
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

  const activeClue = useMemo(() => {
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
    return list.find((cl) => cl.row === sr && cl.col === sc) ?? null;
  }, [active, direction, puzzle]);

  return (
    <div className="space-y-4">
      <SolveToolbar
        t={t}
        canRevealWord={!!active}
        onCheck={check}
        onRevealWord={revealWord}
        onReset={clearAll}
        onCopyLink={copyLink}
        shareUrl={currentUrl()}
        printHref={`/public/puzzles/${puzzle.slug}/print`}
      />

      <SolveStatus t={t} pct={pct} filledCells={filledCells} totalCells={totalCells} status={status} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Pinned beside the clue lists on wide screens: the page scrolls
            through the clues while the grid stays put. */}
        <div className="min-w-0 space-y-3 lg:sticky lg:top-[4.5rem]">
          <ActiveClue
            clue={activeClue}
            direction={direction}
            messages={messages}
            className="lg:hidden"
          />
          {/* The grid shrinks to this column; it only scrolls when the puzzle
              can't fit at a legible cell size (narrow phones, big grids). */}
          <Card className="max-w-full overflow-x-auto border-border/60 bg-card/60 p-2 shadow-sm backdrop-blur-sm sm:p-3">
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
        </div>
        <CluePanels
          puzzle={puzzle}
          messages={messages}
          direction={direction}
          activeNumber={activeClue?.number ?? null}
          onSelectClue={selectClue}
        />
      </div>
    </div>
  );
}
