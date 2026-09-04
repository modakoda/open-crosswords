import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** A supported content language, keyed by a short code (e.g. "en", "lt", "es"). */
export const languages = pgTable("languages", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** A topic grouping, scoped to one language. */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    languageCode: text("language_code")
      .notNull()
      .references(() => languages.code, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("categories_language_slug_unq").on(t.languageCode, t.slug)],
);

/**
 * A single clue/answer pair — the raw material a crossword is generated from.
 * `answerNormalized` is the uppercase A-Z form actually placed in the grid.
 */
export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    languageCode: text("language_code")
      .notNull()
      .references(() => languages.code, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    clue: text("clue").notNull(),
    answer: text("answer").notNull(),
    answerNormalized: text("answer_normalized").notNull(),
    length: smallint("length").notNull(),
    difficulty: smallint("difficulty").notNull().default(3),
    enabled: integer("enabled").notNull().default(1),
    source: text("source").notNull().default("manual"),
    timesUsed: integer("times_used").notNull().default(0),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("entries_lang_idx").on(t.languageCode),
    index("entries_category_idx").on(t.categoryId),
    index("entries_pick_idx").on(t.languageCode, t.enabled, t.length),
    unique("entries_lang_answer_clue_unq").on(
      t.languageCode,
      t.answerNormalized,
      t.clue,
    ),
  ],
);

/** A generated crossword, addressable by a short public slug. */
export const puzzles = pgTable(
  "puzzles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    languageCode: text("language_code")
      .notNull()
      .references(() => languages.code),
    /** Owning client, if generated while signed in. Null for anonymous puzzles. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    paperSize: text("paper_size").notNull(),
    orientation: text("orientation").notNull(),
    width: smallint("width").notNull(),
    height: smallint("height").notNull(),
    seed: text("seed").notNull(),
    /** Placed words: number, row, col, direction, answer, clue. */
    placements: jsonb("placements").notNull(),
    /** Cell matrix: null for a block, otherwise { solution, number? }. */
    grid: jsonb("grid").notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("puzzles_created_idx").on(t.createdAt),
    index("puzzles_user_idx").on(t.userId),
  ],
);
