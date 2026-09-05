"use client";

import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Cell, Direction } from "@/lib/crossword/types";
import { cellKey as key, wordCells, wordEntryCell } from "@/lib/crossword/word";

interface Props {
  grid: Cell[][];
  values: Record<string, string>;
  wrong: Set<string>;
  active: string | null;
  direction: Direction;
  onChange: (r: number, c: number, letter: string) => void;
  onActivate: (r: number, c: number, direction: Direction) => void;
}

export function CrosswordGrid({
  grid,
  values,
  wrong,
  active,
  direction,
  onChange,
  onActivate,
}: Props) {
  const cols = grid[0]?.length ?? 0;
  const refs = useRef(new Map<string, HTMLInputElement>());
  // The browser focuses the input as the default action of the press, and that
  // focus already activates the cell — so by the time the click handler runs,
  // `active` is this cell whether or not it was selected beforehand. Remember
  // what was selected before the press so only a genuine second click toggles.
  const activeBeforePress = useRef<string | null>(null);

  const wordCellsAt = useCallback(
    (r: number, c: number, dir: Direction) => wordCells(grid, r, c, dir),
    [grid],
  );

  // Keys of the cells in the word being edited, for the "in-word" highlight.
  const activeWordKeys = useMemo(() => {
    if (!active) return new Set<string>();
    const [ar, ac] = active.split(",").map(Number);
    return new Set(wordCellsAt(ar, ac, direction).map(([r, c]) => key(r, c)));
  }, [active, direction, wordCellsAt]);

  // Every word in the grid, across first then down, each in reading order — the
  // order Tab walks. A lone white cell isn't a word, so it never gets a turn.
  const words = useMemo(() => {
    const out: { dir: Direction; cells: [number, number][] }[] = [];
    for (const dir of ["across", "down"] as const) {
      const dr = dir === "down" ? 1 : 0;
      const dc = dir === "across" ? 1 : 0;
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
          if (!grid[r][c] || grid[r - dr]?.[c - dc]) continue;
          const cells = wordCellsAt(r, c, dir);
          if (cells.length > 1) out.push({ dir, cells });
        }
      }
    }
    return out;
  }, [grid, wordCellsAt]);

  useEffect(() => {
    if (active) refs.current.get(active)?.focus();
  }, [active]);

  function move(r: number, c: number, dir: Direction, back = false) {
    const dr = (dir === "down" ? 1 : 0) * (back ? -1 : 1);
    const dc = (dir === "across" ? 1 : 0) * (back ? -1 : 1);
    let nr = r + dr;
    let nc = c + dc;
    while (grid[nr] && grid[nr][nc] !== undefined) {
      if (grid[nr][nc]) {
        onActivate(nr, nc, dir);
        return;
      }
      nr += dr;
      nc += dc;
    }
  }

  // After typing, stay inside the current word: go to the next empty cell
  // ahead of the cursor, otherwise wrap back to the first empty cell from the
  // start of the word. A fully filled word keeps the cursor on its last cell.
  function advanceWithinWord(r: number, c: number, dir: Direction) {
    const cells = wordCellsAt(r, c, dir);
    const i = cells.findIndex(([cr, cc]) => cr === r && cc === c);
    if (i < 0) return;
    const empty = ([cr, cc]: [number, number]) => !values[key(cr, cc)];
    const target =
      cells.slice(i + 1).find(empty) ??
      cells.slice(0, i).find(empty) ??
      cells[Math.min(i + 1, cells.length - 1)];
    onActivate(target[0], target[1], dir);
  }

  // A white cell need not sit in a word both ways: an unchecked square crosses
  // nothing, and the preferred direction would trap the cursor in a word one
  // cell long. Fall back to the direction a real word actually runs in.
  function dirWithWord(r: number, c: number, preferred: Direction): Direction {
    if (wordCellsAt(r, c, preferred).length > 1) return preferred;
    const other = preferred === "across" ? "down" : "across";
    return wordCellsAt(r, c, other).length > 1 ? other : preferred;
  }

  // Switching direction moves into the crossing word, so start at its first
  // empty cell rather than wherever the crossing happened to be.
  function activateWordStart(r: number, c: number, dir: Direction) {
    const [sr, sc] = wordEntryCell(wordCellsAt(r, c, dir), values) ?? [r, c];
    onActivate(sr, sc, dir);
  }

  // Tab jumps to the next word (Shift+Tab the previous one), wrapping around
  // the across-then-down order, and lands on that word's first empty cell.
  function moveToWord(r: number, c: number, dir: Direction, back = false) {
    if (!words.length) return;
    const [sr, sc] = wordCellsAt(r, c, dir)[0] ?? [r, c];
    const i = words.findIndex(
      (w) => w.dir === dir && w.cells[0][0] === sr && w.cells[0][1] === sc,
    );
    const at = i < 0 ? 0 : i + (back ? -1 : 1);
    const next = words[(at + words.length) % words.length];
    activateWordStart(next.cells[0][0], next.cells[0][1], next.dir);
  }

  // Backspace on an empty cell steps back one cell, never past the word start.
  function stepBackWithinWord(r: number, c: number, dir: Direction) {
    const cells = wordCellsAt(r, c, dir);
    const i = cells.findIndex(([cr, cc]) => cr === r && cc === c);
    if (i <= 0) return;
    const [pr, pc] = cells[i - 1];
    onActivate(pr, pc, dir);
  }

  // Clicking a cell selects it; clicking the one already selected switches to
  // the crossing word, when the cell has one.
  function selectCell(r: number, c: number, wasSelected: boolean) {
    const crossing = direction === "across" ? "down" : "across";
    if (wasSelected && wordCellsAt(r, c, crossing).length > 1) {
      return activateWordStart(r, c, crossing);
    }
    onActivate(r, c, dirWithWord(r, c, direction));
  }

  function handleKey(r: number, c: number, e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") return onActivate(r, c, "across"), move(r, c, "across");
    if (e.key === "ArrowLeft") return onActivate(r, c, "across"), move(r, c, "across", true);
    if (e.key === "ArrowDown") return onActivate(r, c, "down"), move(r, c, "down");
    if (e.key === "ArrowUp") return onActivate(r, c, "down"), move(r, c, "down", true);
    if (e.key === "Tab") {
      e.preventDefault();
      return moveToWord(r, c, direction, e.shiftKey);
    }
    if (e.key === " ") {
      e.preventDefault();
      const crossing = direction === "across" ? "down" : "across";
      if (wordCellsAt(r, c, crossing).length > 1) activateWordStart(r, c, crossing);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (values[key(r, c)]) onChange(r, c, "");
      else stepBackWithinWord(r, c, direction);
      return;
    }
    if (/^[\p{L}]$/u.test(e.key)) {
      e.preventDefault();
      onChange(r, c, e.key.toUpperCase());
      advanceWithinWord(r, c, direction);
    }
  }

  return (
    <div
      className="xw-grid xw-grid--fluid select-none"
      style={{ "--xw-cols": cols } as CSSProperties}
    >
      {grid.flatMap((row, r) =>
        row.map((cell, c) => {
          const k = key(r, c);
          if (!cell) return <div key={k} className="xw-cell block" />;
          const classes = [
            "xw-cell",
            active === k ? "active" : activeWordKeys.has(k) ? "in-word" : "",
            wrong.has(k) ? "wrong" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={k} className={classes}>
              {cell.number ? <span className="xw-num">{cell.number}</span> : null}
              <input
                ref={(el) => {
                  if (el) refs.current.set(k, el);
                  else refs.current.delete(k);
                }}
                inputMode="text"
                autoCapitalize="characters"
                aria-label={`Row ${r + 1} column ${c + 1}`}
                value={values[k] ?? ""}
                onChange={() => {}}
                onFocus={() => onActivate(r, c, direction)}
                onPointerDown={() => {
                  activeBeforePress.current = active;
                }}
                onClick={() => selectCell(r, c, activeBeforePress.current === k)}
                onKeyDown={(e) => handleKey(r, c, e)}
              />
            </div>
          );
        }),
      )}
    </div>
  );
}
