import { z } from "zod";

export const PAPER_SIZES = ["a4", "a5", "letter", "legal"] as const;
export const ORIENTATIONS = ["portrait", "landscape"] as const;
export const DIFFICULTY_LEVELS = ["any", "easy", "medium", "hard"] as const;
export const LANGUAGE_CODE = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2}(-[a-z]{2})?$/, "Expected a BCP-47 code like 'en' or 'pt-br'");

/**
 * Public puzzle slug. Generated ones read `amber-quiet-otter-canyon-48392174`
 * (see `generatePuzzleSlug`); the wider character set and length keep the
 * short random ids issued before that format valid too.
 */
export const puzzleSlugSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{6,64}$/, "Bad slug");

export const generatePuzzleSchema = z.object({
  languageCode: LANGUAGE_CODE,
  categoryIds: z.array(z.uuid()).max(24).optional(),
  paperSize: z.enum(PAPER_SIZES),
  orientation: z.enum(ORIENTATIONS).default("portrait"),
  difficulty: z.enum(DIFFICULTY_LEVELS).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  seed: z.string().trim().min(1).max(64).optional(),
});
export type GeneratePuzzleInput = z.infer<typeof generatePuzzleSchema>;

const clue = z.string().trim().min(3).max(500);
const answer = z.string().trim().min(2).max(48);
const difficulty = z.coerce.number().int().min(1).max(5);

export const createEntrySchema = z.object({
  languageCode: LANGUAGE_CODE,
  categoryId: z.uuid().nullish(),
  clue,
  answer,
  difficulty: difficulty.default(3),
  source: z.enum(["manual", "import", "ai", "seed"]).default("manual"),
});
export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const updateEntrySchema = z
  .object({
    // Moving an entry between languages is allowed; its category can't follow,
    // since categories are scoped to one language (see `updateEntry`).
    languageCode: LANGUAGE_CODE,
    categoryId: z.uuid().nullish(),
    clue,
    answer,
    difficulty,
    enabled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

/**
 * Bulk delete. The cap keeps one request bounded — the admin UI can only
 * select the rows on the current page, whose size tops out at the listing's
 * own 200-row limit.
 */
export const deleteEntriesSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
});

/**
 * Bulk puzzle delete. Same bound as the entries batch, and for the same
 * reason: the admin UI can only tick rows on the page it is showing.
 */
export const deletePuzzlesSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
});

export const listEntriesQuerySchema = z.object({
  languageCode: LANGUAGE_CODE.optional(),
  categoryId: z.uuid().optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listPuzzlesQuerySchema = z.object({
  languageCode: LANGUAGE_CODE.optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  /** Undefined lists every account; true/false narrows to one side. */
  verified: z.boolean().optional(),
  /**
   * Blocked *right now*, i.e. the flag with an expiry that hasn't passed —
   * an account whose timed block has lapsed reads as not blocked here.
   */
  blocked: z.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Blocking an account. The reason is an operator's note shown only on the
 * admin screen, so it is bounded but otherwise free text; `days` absent means
 * an indefinite block, and the ceiling exists so a mistyped number can't put
 * an expiry so far out that it is indistinguishable from indefinite while
 * still reading as temporary.
 */
export const MAX_BLOCK_DAYS = 365;

export const blockUserSchema = z.object({
  id: z.string().trim().min(1).max(255),
  reason: z.string().trim().max(500).optional(),
  days: z.coerce.number().int().min(1).max(MAX_BLOCK_DAYS).optional(),
});

/**
 * better-auth mints user ids itself (a random string, not a uuid), so this can
 * only bound the shape — the id is looked up, never trusted.
 */
export const userIdSchema = z.object({ id: z.string().trim().min(1).max(255) });

export const renamePuzzleSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(120),
});

export const importSchema = z.object({
  languageCode: LANGUAGE_CODE,
  format: z.enum(["json", "csv"]).default("json"),
  text: z.string().min(1).max(500_000),
  createMissingCategories: z.boolean().default(true),
});

export const importRowSchema = z.object({
  clue,
  answer,
  category: z.string().trim().min(1).max(80).optional(),
  difficulty: difficulty.optional(),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export const aiDraftSchema = z.object({
  languageCode: LANGUAGE_CODE,
  topic: z.string().trim().min(2).max(120),
  count: z.coerce.number().int().min(1).max(20).default(10),
  categoryName: z.string().trim().min(1).max(80).optional(),
});
export type AiDraftInput = z.infer<typeof aiDraftSchema>;

export const createLanguageSchema = z.object({
  code: LANGUAGE_CODE,
  name: z.string().trim().min(1).max(80).optional(),
});

/** Renaming only touches the display name; the code is the row's identity. */
export const renameLanguageSchema = z.object({
  code: LANGUAGE_CODE,
  name: z.string().trim().min(1).max(80),
});

/** Deleting takes only the code — the row's identity, and all the guard needs. */
export const deleteLanguageSchema = z.object({ code: LANGUAGE_CODE });

export const createCategorySchema = z.object({
  languageCode: LANGUAGE_CODE,
  name: z.string().trim().min(1).max(80),
});

const cellKey = z.string().regex(/^\d{1,3},\d{1,3}$/);
const cellLetter = z.string().trim().toUpperCase().length(1);

export const solveStateSchema = z.object({
  puzzleId: z.uuid(),
  progress: z.record(cellKey, cellLetter),
});
