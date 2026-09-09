import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { adminProcedure } from "@/lib/orpc/middleware";
import { isAdminEmail } from "@/lib/auth-guard";
import { deleteUser, findUser, listUsers, revokeUserSessions } from "@/lib/users";
import { blockUser, unblockUser } from "@/lib/user-block";
import { clearAccountLock } from "@/lib/sign-in-lock";
import {
  blockUserSchema,
  listUsersQuerySchema,
  userIdSchema,
} from "@/lib/validation/schemas";

/**
 * Pins exactly what a listing may carry. The `user` row also holds
 * better-auth's own fields and sits one join away from `account`, which holds
 * the password hash — without this, keeping those out of an admin's browser
 * would rest only on the query's select list, one careless `select()` away.
 */
const userRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  isAdmin: z.boolean(),
  holdsAdminAddress: z.boolean(),
  puzzleCount: z.number(),
  solveCount: z.number(),
  activeSessions: z.number(),
  blocked: z.boolean(),
  blockedReason: z.string().nullable(),
  blockedAt: z.string().nullable(),
  blockedUntil: z.string().nullable(),
  signInLockSeconds: z.number(),
  createdAt: z.string(),
});

const list = adminProcedure
  .input(listUsersQuerySchema)
  .output(z.object({ rows: z.array(userRowSchema), total: z.number() }))
  .handler(async ({ input }) => listUsers(input));

/**
 * Resolve the target of an action that *takes* access away — deletion, session
 * revocation, blocking — and refuse the two cases that would turn this screen
 * into a way to remove administrators.
 *
 * Both guards are keyed to the row the *server* read, never to anything the
 * caller sent, and the admin one tests exactly the pair `getAdmin` demands:
 * allow-listed *and* verified. Testing membership alone would over-protect —
 * `npm run create-admin` verifies in the same run and refuses an address an
 * unverified account already holds, so an allow-listed-but-unverified row is
 * a public sign-up squatting that address, with no admin access and nothing
 * to protect. Shielding it would make it undeletable from here and leave the
 * address unprovisionable for good.
 */
async function destructiveTarget(id: string, adminId: string) {
  if (id === adminId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "You cannot do that to your own account",
    });
  }
  const target = await restorativeTarget(id);
  if (isAdminEmail(target.email) && target.emailVerified) {
    throw new ORPCError("FORBIDDEN", {
      message:
        "Admin accounts are managed out-of-band — remove the address from ADMIN_EMAILS instead",
    });
  }
  return target;
}

/**
 * Resolve the target of an action that only ever *gives* access back —
 * unblocking, releasing a sign-in lock. Deliberately none of the refusals
 * above: those exist to stop this screen removing an administrator, and
 * applying them here would instead make an administrator's lockout
 * unrecoverable from inside the app.
 *
 * That is not hypothetical for either action. An address can be blocked while
 * it is not yet allow-listed and then added to ADMIN_EMAILS, at which point
 * the guard would shield the one row that needs lifting — and `create-admin`
 * leaves an existing verified account alone, so re-provisioning would not fix
 * it either. The account-wide sign-in backoff is by construction a lever an
 * outsider can run up against any address they merely know (see
 * src/lib/auth-throttle.ts), so refusing to release it for admin accounts
 * would withhold the remedy from exactly the accounts worth attacking. The
 * self-target refusal goes too: releasing your own lock restores nothing you
 * do not already have.
 */
async function restorativeTarget(id: string) {
  const target = await findUser(id);
  if (!target) throw new ORPCError("NOT_FOUND", { message: "User not found" });
  return target;
}

/**
 * Deleting an account frees its email for re-registration and drops its solve
 * progress; the puzzles it generated survive as anonymous ones, so no shared
 * link breaks.
 */
const remove = adminProcedure
  .input(userIdSchema)
  .handler(async ({ input, context }) => {
    const target = await destructiveTarget(input.id, context.admin.id);
    const deleted = await deleteUser(target.id);
    if (!deleted) throw new ORPCError("NOT_FOUND", { message: "User not found" });
    return { deleted: true, email: deleted.email };
  });

/**
 * Sign an account out of every device. Recoverable — they can sign back in —
 * but it runs through the same guard as deletion: the point of the admin guard
 * is that this screen can't be used against an administrator's access at all.
 */
const revokeSessions = adminProcedure
  .input(userIdSchema)
  .handler(async ({ input, context }) => {
    const target = await destructiveTarget(input.id, context.admin.id);
    return { revoked: await revokeUserSessions(target.id) };
  });

/**
 * Block an account: it cannot sign in, and every session it holds is dropped.
 * Reversible, and deliberately not deletion — the account keeps its puzzles
 * and its address stays taken.
 *
 * `days` is turned into an absolute expiry here rather than stored as a
 * duration, so the block ends at a fixed instant no matter when anything reads
 * it. Who may be targeted is `destructiveTarget`'s: an admin can't be blocked,
 * since that would be a way to remove an administrator's access from a screen
 * that must never be able to.
 */
const block = adminProcedure
  .input(blockUserSchema)
  .handler(async ({ input, context }) => {
    const target = await destructiveTarget(input.id, context.admin.id);
    const now = new Date();
    const until = input.days
      ? new Date(now.getTime() + input.days * 24 * 60 * 60 * 1000)
      : null;
    const result = await blockUser(target.id, {
      reason: input.reason?.trim() || null,
      until,
      now,
    });
    if (!result.blocked) {
      throw new ORPCError("NOT_FOUND", { message: "User not found" });
    }
    return {
      email: target.email,
      blockedUntil: until?.toISOString() ?? null,
      revokedSessions: result.revokedSessions,
    };
  });

/**
 * Lift a block. Restorative, so it is deliberately not behind the
 * admin-account guard — see `restorativeTarget`.
 */
const unblock = adminProcedure
  .input(userIdSchema)
  .handler(async ({ input }) => {
    const target = await restorativeTarget(input.id);
    if (!(await unblockUser(target.id))) {
      throw new ORPCError("NOT_FOUND", { message: "User not found" });
    }
    return { email: target.email };
  });

/**
 * Release the account-wide sign-in backoff for one address (see
 * src/lib/sign-in-lock.ts). This is the counter an outsider can run up against
 * an address they merely know, so clearing it is the manual remedy for someone
 * locked out of their own account.
 *
 * It hands back only that budget. The tight per-address counter, which is what
 * actually bounds password guessing, is keyed by a digest of an address this
 * app never stores and cannot be reached from here at all — which is why
 * releasing this one is safe against any account, an administrator's included.
 */
const clearSignInLock = adminProcedure
  .input(userIdSchema)
  .handler(async ({ input }) => {
    const target = await restorativeTarget(input.id);
    return { email: target.email, cleared: await clearAccountLock(target.email) };
  });

export const adminUsersRouter = {
  list,
  delete: remove,
  revokeSessions,
  block,
  unblock,
  clearSignInLock,
};
