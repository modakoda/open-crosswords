/**
 * Geometry for the printable crossword sheet.
 *
 * The print view must fit the puzzle (grid + clues) on exactly one sheet, and
 * the answer key on exactly one more. Browsers give us no measurement hook
 * before paint, so we size everything up front from the paper dimensions: the
 * cell size shrinks until the grid fits its share of the page, then the clue
 * font and column count shrink until the estimated clue text fits whatever
 * height is left.
 */

export interface PageMm {
  width: number;
  height: number;
}

/** Physical paper sizes in millimetres, portrait. */
const PAGE_SIZES_MM: Record<string, PageMm> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
};

const PRINT_MARGIN_MM = 12;

/** Vertical space reserved for the sheet heading, above the grid. */
const TITLE_MM = 9;
/** Gap between the grid and the clue columns. */
const GRID_GAP_MM = 4;
/** Height of one "Across"/"Down" heading inside the clue flow. */
const CLUE_HEADING_MM = 5;
/** Gutter between clue columns. */
export const CLUE_GUTTER_MM = 5;

/** Comfortable hand-writing cell; also the generator's sizing unit. */
export const MAX_CELL_MM = 7;
const MIN_CELL_MM = 3.4;
/** Share of the content height the grid may claim before it must shrink. */
const GRID_HEIGHT_SHARE = 0.62;

const PT_TO_MM = 0.352_777_8;
/** Mean glyph advance as a fraction of font size, for proportional text. */
const AVG_CHAR_RATIO = 0.5;
const LINE_HEIGHT_RATIO = 1.3;
/** Slack absorbing the difference between estimated and real text metrics. */
const SAFETY = 1.1;

const FONT_STEPS_PT = [9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5];
/** Font sizes we consider before sacrificing grid size. */
const COMFORT_FONTS_PT = FONT_STEPS_PT.filter((pt) => pt >= 7);
const COLUMN_STEPS = [2, 3];
/** Successive shrink factors applied to the grid when the clues won't fit. */
const CELL_SCALES = [1, 0.92, 0.84, 0.76, 0.68, 0.6];

export interface ClueText {
  /** Rendered length of one clue line, in characters. */
  length: number;
}

export interface SheetLayout {
  /** `size` value for the `@page` rule, e.g. `210mm 297mm`. */
  pageCss: string;
  contentWidthMm: number;
  contentHeightMm: number;
  cellMm: number;
  clueFontPt: number;
  clueColumns: number;
}

export function contentBox(paperSize: string, orientation: string): PageMm {
  const page = PAGE_SIZES_MM[paperSize] ?? PAGE_SIZES_MM.a4;
  const landscape = orientation === "landscape";
  const width = landscape ? page.height : page.width;
  const height = landscape ? page.width : page.height;
  return {
    width: width - 2 * PRINT_MARGIN_MM,
    height: height - 2 * PRINT_MARGIN_MM,
  };
}

/** Largest cell size that keeps a `cols`x`rows` grid inside the content box. */
export function fitCellMm(cols: number, rows: number, box: PageMm): number {
  if (cols <= 0 || rows <= 0) return MAX_CELL_MM;
  const byWidth = box.width / cols;
  const byHeight = ((box.height - TITLE_MM) * GRID_HEIGHT_SHARE) / rows;
  // Width is a hard constraint: an overflowing grid would be clipped by the
  // sheet, so the legibility floor only applies to the height-driven shrink.
  const fit = Math.max(MIN_CELL_MM, Math.min(MAX_CELL_MM, byHeight));
  return Math.floor(Math.min(fit, byWidth) * 100) / 100;
}

/** Estimated stacked height, in mm, of clue text laid out in `columns`. */
export function clueBlockMm(
  clues: ClueText[],
  columns: number,
  fontPt: number,
  contentWidthMm: number,
): number {
  const fontMm = fontPt * PT_TO_MM;
  const colWidth =
    (contentWidthMm - (columns - 1) * CLUE_GUTTER_MM) / columns;
  const charsPerLine = Math.max(8, colWidth / (fontMm * AVG_CHAR_RATIO));
  const lineMm = fontMm * LINE_HEIGHT_RATIO;
  const lines = clues.reduce(
    (sum, c) => sum + Math.max(1, Math.ceil(c.length / charsPerLine)),
    0,
  );
  const total = lines * lineMm + 2 * CLUE_HEADING_MM;
  return (total * SAFETY) / columns;
}

/** Height left for clue text once the heading and grid have taken their share. */
export function clueSpaceMm(box: PageMm, rows: number, cellMm: number): number {
  return box.height - TITLE_MM - rows * cellMm - GRID_GAP_MM;
}

/** Largest font/column pair from `fonts` whose clue block fits `availableMm`. */
function fitClues(
  clues: ClueText[],
  contentWidthMm: number,
  availableMm: number,
  fonts: number[],
): { clueFontPt: number; clueColumns: number } | null {
  for (const clueFontPt of fonts) {
    for (const clueColumns of COLUMN_STEPS) {
      if (
        clueBlockMm(clues, clueColumns, clueFontPt, contentWidthMm) <=
        availableMm
      ) {
        return { clueFontPt, clueColumns };
      }
    }
  }
  return null;
}

/**
 * Picks the cell size, clue font and column count for one sheet.
 *
 * Preference order: keep the grid at its natural size and only reduce the clue
 * font to a still-comfortable 7pt; if that isn't enough, shrink the grid step
 * by step; as a last resort at the smallest grid, drop the font to its floor.
 */
export function sheetLayout(opts: {
  paperSize: string;
  orientation: string;
  cols: number;
  rows: number;
  clues: ClueText[];
}): SheetLayout {
  const box = contentBox(opts.paperSize, opts.orientation);
  const ideal = fitCellMm(opts.cols, opts.rows, box);
  const scaled = (scale: number) =>
    Math.min(ideal, Math.max(MIN_CELL_MM, Math.floor(ideal * scale * 100) / 100));

  let cellMm = scaled(CELL_SCALES[CELL_SCALES.length - 1]);
  let fit = fitClues(
    opts.clues,
    box.width,
    clueSpaceMm(box, opts.rows, cellMm),
    FONT_STEPS_PT,
  );

  for (const scale of CELL_SCALES) {
    const candidate = scaled(scale);
    const comfortable = fitClues(
      opts.clues,
      box.width,
      clueSpaceMm(box, opts.rows, candidate),
      COMFORT_FONTS_PT,
    );
    if (comfortable) {
      cellMm = candidate;
      fit = comfortable;
      break;
    }
  }

  return {
    pageCss: `${box.width + 2 * PRINT_MARGIN_MM}mm ${
      box.height + 2 * PRINT_MARGIN_MM
    }mm`,
    contentWidthMm: box.width,
    contentHeightMm: box.height,
    cellMm,
    clueFontPt: fit?.clueFontPt ?? FONT_STEPS_PT[FONT_STEPS_PT.length - 1],
    clueColumns: fit?.clueColumns ?? COLUMN_STEPS[0],
  };
}
