import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { adminProcedure } from "@/lib/orpc/middleware";
import { isAdminEmail } from "@/lib/auth-guard";
import { deleteUser, findUser, listUsers, revokeUserSessions } from "@/lib/users";
import { listUsersQuerySchema, userIdSchema } from "@/lib/validation/schemas";

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
  createdAt: z.string(),
});

const list = adminProcedure
  .input(listUsersQuerySchema)
  .output(z.object({ rows: z.array(userRowSchema), total: z.number() }))
  .handler(async ({ input }) => listUsers(input));

/**
 * Resolve the target of a destructive action and refuse the two cases that
 * would turn this screen into a way to remove administrators.
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
async function targetOf(id: string, adminId: string) {
  if (id === adminId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "You cannot do that to your own account",
    });
  }
  const target = await findUser(id);
  if (!target) throw new ORPCError("NOT_FOUND", { message: "User not found" });
  if (isAdminEmail(target.email) && target.emailVerified) {
    throw new ORPCError("FORBIDDEN", {
      message:
        "Admin accounts are managed out-of-band — remove the address from ADMIN_EMAILS instead",
    });
  }
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
    const target = await targetOf(input.id, context.admin.id);
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
    const target = await targetOf(input.id, context.admin.id);
    return { revoked: await revokeUserSessions(target.id) };
  });

export const adminUsersRouter = { list, delete: remove, revokeSessions };
