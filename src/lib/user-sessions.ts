import { eq } from "drizzle-orm";
import { db } from "@/db";
import { session } from "@/db/schema";

/**
 * Drop every session row for an account, signing it out everywhere. Expired
 * rows are deleted too — they are dead weight, and counting only live ones
 * would report a number the admin can't reconcile with the listing.
 *
 * Its own module because two callers need it and they must not be made to
 * import each other: the admin listing (./users.ts) and the sign-in hook
 * (./auth-hooks.ts), which sits underneath ./auth.ts and would otherwise close
 * a cycle back through the auth guard. Blocking does the same delete inside
 * its own transaction (./user-block.ts).
 */
export async function revokeUserSessions(userId: string): Promise<number> {
  const rows = await db
    .delete(session)
    .where(eq(session.userId, userId))
    .returning({ id: session.id });
  return rows.length;
}
