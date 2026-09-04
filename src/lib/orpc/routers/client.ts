import { userProcedure } from "@/lib/orpc/middleware";
import { getSolveState, saveSolveState } from "@/lib/solve-state";
import { solveStateSchema } from "@/lib/validation/schemas";
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

export const clientRouter = {
  solveState: { get: solveStateGet, save: solveStateSave },
};
