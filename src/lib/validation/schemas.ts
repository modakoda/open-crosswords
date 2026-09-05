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
    categoryId: z.uuid().nullish(),
    clue,
    answer,
    difficulty,
    enabled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

export const listEntriesQuerySchema = z.object({
  languageCode: LANGUAGE_CODE.optional(),
  categoryId: z.uuid().optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
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
