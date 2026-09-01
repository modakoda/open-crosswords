import type { Crossword } from "./types";

/**
 * Assign standard crossword numbering: scan cells row-major, number any white
 * cell that begins an across and/or a down word, then propagate those numbers
 * onto the matching placements.
 */
export function assignNumbers(cw: Crossword): Crossword {
  const { grid, width, height } = cw;
  const numberAt = new Map<string, number>();
  let n = 0;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      const startAcross =
        (c === 0 || !grid[r][c - 1]) && c + 1 < width && !!grid[r][c + 1];
      const startDown =
        (r === 0 || !grid[r - 1][c]) && r + 1 < height && !!grid[r + 1][c];
      if (startAcross || startDown) {
        n += 1;
        cell.number = n;
        numberAt.set(`${r},${c}`, n);
      }
    }
  }

  const placements = cw.placements
    .map((p) => ({ ...p, number: numberAt.get(`${p.row},${p.col}`) ?? 0 }))
    .sort((a, b) => a.number - b.number || (a.direction < b.direction ? -1 : 1));

  return { ...cw, placements };
}
