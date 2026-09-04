import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { solveStates } from "@/db/schema";

/** Cell key ("r,c") -> single uppercase letter, mirroring the client's localStorage cache. */
export type SolveProgress = Record<string, string>;

/** Always scoped to the caller's own userId — never trust a client-supplied one. */
export async function getSolveState(
  userId: string,
  puzzleId: string,
): Promise<SolveProgress | null> {
  const row = await db.query.solveStates.findFirst({
    where: and(eq(solveStates.userId, userId), eq(solveStates.puzzleId, puzzleId)),
  });
  return row ? (row.progress as SolveProgress) : null;
}

export async function saveSolveState(
  userId: string,
  puzzleId: string,
  progress: SolveProgress,
): Promise<void> {
  await db
    .insert(solveStates)
    .values({ userId, puzzleId, progress, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [solveStates.puzzleId, solveStates.userId],
      set: { progress, updatedAt: new Date() },
    });
}
