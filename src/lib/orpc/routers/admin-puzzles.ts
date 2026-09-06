import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { adminProcedure } from "@/lib/orpc/middleware";
import { deletePuzzle, listPuzzles, renamePuzzle } from "@/lib/puzzles";
import { listPuzzlesQuerySchema, renamePuzzleSchema } from "@/lib/validation/schemas";

/**
 * Pins exactly what a listing may carry. Without it the redaction — no seed,
 * no grid, no placements, and no owner field beyond the email — would rest
 * only on the query's select list, one careless `select()` away from leaking.
 */
const puzzleRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  languageCode: z.string(),
  paperSize: z.string(),
  orientation: z.string(),
  width: z.number(),
  height: z.number(),
  wordCount: z.number(),
  ownerEmail: z.email().nullable(),
  createdAt: z.string(),
});

const list = adminProcedure
  .input(listPuzzlesQuerySchema)
  .output(z.object({ rows: z.array(puzzleRowSchema), total: z.number() }))
  .handler(async ({ input }) => listPuzzles(input));

const rename = adminProcedure
  .input(renamePuzzleSchema)
  .handler(async ({ input }) => {
    const puzzle = await renamePuzzle(input.id, input.title);
    if (!puzzle) throw new ORPCError("NOT_FOUND", { message: "Puzzle not found" });
    return { puzzle };
  });

const remove = adminProcedure
  .input(z.object({ id: z.uuid() }))
  .handler(async ({ input }) => {
    const deleted = await deletePuzzle(input.id);
    if (!deleted) throw new ORPCError("NOT_FOUND", { message: "Puzzle not found" });
    return { deleted: true };
  });

export const adminPuzzlesRouter = { list, rename, delete: remove };
