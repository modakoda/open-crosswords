import type { Cell, Direction } from "./types";

/** Key for a cell in the `values`/`wrong` maps the solve UI passes around. */
export const cellKey = (r: number, c: number) => `${r},${c}`;

export type CellPos = [row: number, col: number];

/**
 * The run of white cells the given cell belongs to in `dir`, in reading order,
 * bounded by blocks and the grid edges. Empty when the cell itself is a block.
 */
export function wordCells(
  grid: Cell[][],
  r: number,
  c: number,
  dir: Direction,
): CellPos[] {
  if (!grid[r]?.[c]) return [];
  const dr = dir === "down" ? 1 : 0;
  const dc = dir === "across" ? 1 : 0;
  let sr = r;
  let sc = c;
  while (grid[sr - dr]?.[sc - dc]) {
    sr -= dr;
    sc -= dc;
  }
  const cells: CellPos[] = [];
  while (grid[sr]?.[sc]) {
    cells.push([sr, sc]);
    sr += dr;
    sc += dc;
  }
  return cells;
}

/**
 * Where the cursor should land when entering a word: its first cell without a
 * letter, skipping the ones already filled. A full word falls back to its start.
 */
export function wordEntryCell(
  cells: CellPos[],
  values: Record<string, string>,
): CellPos | undefined {
  return cells.find(([r, c]) => !values[cellKey(r, c)]) ?? cells[0];
}
