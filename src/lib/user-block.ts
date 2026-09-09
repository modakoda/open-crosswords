import { and, eq, isNull, gt, or } from "drizzle-orm";
import { db } from "@/db";
import { NOW_UTC } from "@/db/now";
import { session, user } from "@/db/schema";

/**
 * Administrative blocking of a client account: the account keeps existing and
 * keeps its puzzles, but it cannot sign in and any session it already holds
 * stops authorizing anything.
 *
 * A block is stored as a flag plus an optional expiry, and "blocked right now"
 * is derived from the pair rather than written back when a timed block lapses.
 * Two reasons: a lapsed block still has a reason and a date worth reading on
 * the admin screen, and nothing has to run on a schedule for a block to end —
 * a job that failed to run would silently extend it.
 *
 * This module only records the decision. Refusing the blocked account is done
 * in two places that must both stay: `src/lib/auth-guard.ts` refuses every
 * session it resolves, and `src/lib/auth-hooks.ts` refuses the sign-in itself.
 * Neither is redundant — the guard is what makes a session already in flight
 * inert, and the hook is what stops a blocked account from collecting a fresh
 * cookie it would then find useless.
 */

export interface BlockState {
  /** The stored flag — an admin blocked this account at some point. */
  blocked: boolean;
  blockedReason: string | null;
  blockedAt: Date | null;
  /** null while `blocked` means indefinite. */
  blockedUntil: Date | null;
}

/**
 * Whether a block is in force at `now`. The one definition of the rule — every
 * caller, in SQL or in TypeScript, must agree, or an account refused at
 * sign-in could still be shown as active (or worse, the reverse).
 */
export function isBlocked(
  state: Pick<BlockState, "blocked" | "blockedUntil">,
  now: Date = new Date(),
): boolean {
  if (!state.blocked) return false;
  return state.blockedUntil === null || state.blockedUntil.getTime() > now.getTime();
}

/** `isBlocked` as a SQL predicate over the `user` row, for listing and filtering. */
export const BLOCK_ACTIVE_SQL = and(
  eq(user.blocked, true),
  or(isNull(user.blockedUntil), gt(user.blockedUntil, NOW_UTC)),
)!;

/**
 * The block state of one account, or null when no such account exists.
 * Deliberately its own read rather than something taken off the session
 * better-auth hands back: the guard must not depend on better-auth choosing to
 * serialize columns it does not know about.
 */
export async function readBlockState(
  userId: string,
): Promise<BlockState | null> {
  const [row] = await db
    .select({
      blocked: user.blocked,
      blockedReason: user.blockedReason,
      blockedAt: user.blockedAt,
      blockedUntil: user.blockedUntil,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row ?? null;
}

/** Whether this account is blocked right now. Unknown ids read as not blocked. */
export async function isUserBlocked(
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const state = await readBlockState(userId);
  return state !== null && isBlocked(state, now);
}

export interface BlockOptions {
  reason?: string | null;
  /** Absolute expiry, or null/undefined for an indefinite block. */
  until?: Date | null;
  now?: Date;
}

/**
 * Block an account and sign it out everywhere, in one transaction: a failure
 * to drop the sessions must not leave the caller told the block failed while
 * it is in fact already in force, which is what an admin would then act on.
 * Revoking is not cosmetic: the auth guard refuses a blocked session on every
 * request, but dropping the rows is what makes that immediate and cheap rather
 * than leaving credentials lying around that only a check keeps inert.
 *
 * Callers must apply the admin-account and self-target guards first; this
 * enforces nothing on its own.
 */
export async function blockUser(
  userId: string,
  { reason = null, until = null, now = new Date() }: BlockOptions = {},
): Promise<{ blocked: boolean; revokedSessions: number }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(user)
      .set({
        blocked: true,
        blockedReason: reason,
        blockedAt: now,
        blockedUntil: until,
        updatedAt: now,
      })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (!row) return { blocked: false, revokedSessions: 0 };

    const revoked = await tx
      .delete(session)
      .where(eq(session.userId, userId))
      .returning({ id: session.id });
    return { blocked: true, revokedSessions: revoked.length };
  });
}

/**
 * Lift a block. The reason and dates are cleared with it — they describe a
 * block that is over, and leaving them would make a plain account read as one
 * that is still serving a lapsed sentence.
 *
 * Sessions are not restored: they were deleted, and the account simply signs
 * in again.
 */
export async function unblockUser(userId: string): Promise<boolean> {
  const [row] = await db
    .update(user)
    .set({
      blocked: false,
      blockedReason: null,
      blockedAt: null,
      blockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  return Boolean(row);
}
