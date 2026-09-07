import { ORPCError } from "@orpc/server";
import { userProcedure } from "@/lib/orpc/middleware";
import { deleteOwnPuzzle } from "@/lib/puzzles";
import { getSolveState, saveSolveState } from "@/lib/solve-state";
import { puzzleSlugSchema, solveStateSchema } from "@/lib/validation/schemas";
import { z } from "zod";

const solveStateGet = userProcedure
  .input(z.object({ puzzleId: z.uuid() }))
  .handler(async ({ input, context }) => {
    return { progress: await getSolveState(context.user.id, input.puzzleId) };
  });

const solveStateSave = userProcedure
  .input(solveStateSchema)
  .handler(async ({ input, context }) => {
    await saveSolveState(context.user.id, input.puzzleId, input.progress);
    return { ok: true };
  });

/**
 * Delete a puzzle the caller owns. The owner is the session's user, never a
 * client-supplied id, and a puzzle owned by someone else is indistinguishable
 * from one that doesn't exist.
 */
const puzzleDelete = userProcedure
  .input(z.object({ slug: puzzleSlugSchema }))
  .handler(async ({ input, context }) => {
    const deleted = await deleteOwnPuzzle(context.user.id, input.slug);
    if (!deleted) throw new ORPCError("NOT_FOUND", { message: "Puzzle not found" });
    return { deleted: true };
  });

export const clientRouter = {
  solveState: { get: solveStateGet, save: solveStateSave },
  puzzles: { delete: puzzleDelete },
};
