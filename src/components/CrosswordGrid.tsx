"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Cell, Direction } from "@/lib/crossword/types";

const key = (r: number, c: number) => `${r},${c}`;

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

  const wordCells = useMemo(() => {
    const set = new Set<string>();
    if (!active) return set;
    const [ar, ac] = active.split(",").map(Number);
    if (!grid[ar]?.[ac]) return set;
    const dr = direction === "down" ? 1 : 0;
    const dc = direction === "across" ? 1 : 0;
    let r = ar;
    let c = ac;
    while (grid[r - dr]?.[c - dc]) {
      r -= dr;
      c -= dc;
    }
    while (grid[r]?.[c]) {
      set.add(key(r, c));
      r += dr;
      c += dc;
    }
    return set;
  }, [active, direction, grid]);

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

  function handleKey(r: number, c: number, e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") return onActivate(r, c, "across"), move(r, c, "across");
    if (e.key === "ArrowLeft") return onActivate(r, c, "across"), move(r, c, "across", true);
    if (e.key === "ArrowDown") return onActivate(r, c, "down"), move(r, c, "down");
    if (e.key === "ArrowUp") return onActivate(r, c, "down"), move(r, c, "down", true);
    if (e.key === " ") {
      e.preventDefault();
      return onActivate(r, c, direction === "across" ? "down" : "across");
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (values[key(r, c)]) onChange(r, c, "");
      else move(r, c, direction, true);
      return;
    }
    if (/^[\p{L}]$/u.test(e.key)) {
      e.preventDefault();
      onChange(r, c, e.key.toUpperCase());
      move(r, c, direction);
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
            active === k ? "active" : wordCells.has(k) ? "in-word" : "",
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
                onClick={() =>
                  onActivate(
                    r,
                    c,
                    active === k
                      ? direction === "across"
                        ? "down"
                        : "across"
                      : direction,
                  )
                }
                onKeyDown={(e) => handleKey(r, c, e)}
              />
            </div>
          );
        }),
      )}
    </div>
  );
}
