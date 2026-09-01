import type { PAPER_SIZES, ORIENTATIONS } from "@/lib/validation/schemas";

export type PaperSize = (typeof PAPER_SIZES)[number];
export type Orientation = (typeof ORIENTATIONS)[number];

/** Printable area in millimetres (page size minus a ~14mm margin each side). */
const SHEET_MM: Record<PaperSize, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  a5: { w: 148, h: 210 },
  letter: { w: 216, h: 279 },
  legal: { w: 216, h: 356 },
};

const MARGIN_MM = 14;
const CELL_MM = 7; // comfortable hand-writing cell
const CLUE_RESERVE_FRAC = 0.42; // share of the sheet kept for the clue list

/** Grid bounds + word target sized to fit the chosen sheet when printed. */
export function paperToGrid(
  paper: PaperSize,
  orientation: Orientation,
): { maxSize: number; targetWords: number } {
  const sheet = SHEET_MM[paper];
  const w = orientation === "portrait" ? sheet.w : sheet.h;
  const h = orientation === "portrait" ? sheet.h : sheet.w;

  const usableW = w - MARGIN_MM * 2;
  const usableH = (h - MARGIN_MM * 2) * (1 - CLUE_RESERVE_FRAC);

  const cols = Math.floor(usableW / CELL_MM);
  const rows = Math.floor(usableH / CELL_MM);
  const maxSize = Math.max(9, Math.min(cols, rows, 23));
  const targetWords = Math.round(maxSize * 1.1);

  return { maxSize, targetWords };
}
