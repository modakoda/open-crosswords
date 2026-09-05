import type { PAPER_SIZES, ORIENTATIONS } from "@/lib/validation/schemas";
import { contentBox, MAX_CELL_MM } from "@/lib/print-layout";

export type PaperSize = (typeof PAPER_SIZES)[number];
export type Orientation = (typeof ORIENTATIONS)[number];

const CLUE_RESERVE_FRAC = 0.42; // share of the sheet kept for the clue list

/** Grid bounds + word target sized to fit the chosen sheet when printed. */
export function paperToGrid(
  paper: PaperSize,
  orientation: Orientation,
): { maxSize: number; targetWords: number } {
  // Same printable box the print sheet uses, so a generated grid always has a
  // full-size 7mm rendering available.
  const box = contentBox(paper, orientation);

  const cols = Math.floor(box.width / MAX_CELL_MM);
  const rows = Math.floor((box.height * (1 - CLUE_RESERVE_FRAC)) / MAX_CELL_MM);
  const maxSize = Math.max(9, Math.min(cols, rows, 23));
  const targetWords = Math.round(maxSize * 1.1);

  return { maxSize, targetWords };
}
