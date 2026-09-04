import { jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { puzzles } from "./content";

/**
 * A signed-in client's solve progress for one puzzle, synced across devices.
 * Anonymous solving stays localStorage-only and never reaches this table.
 */
export const solveStates = pgTable(
  "solve_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    puzzleId: uuid("puzzle_id")
      .notNull()
      .references(() => puzzles.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Same shape as the client's localStorage cache: { "r,c": "LETTER" }. */
    progress: jsonb("progress").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("solve_states_puzzle_user_unq").on(t.puzzleId, t.userId)],
);
