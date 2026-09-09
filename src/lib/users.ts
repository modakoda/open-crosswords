import { and, desc, eq, ilike, not, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { NOW_UTC } from "@/db/now";
import { puzzles, session, solveStates, user } from "@/db/schema";
import { isAdminEmail } from "@/lib/auth-guard";
import { BLOCK_ACTIVE_SQL, isBlocked } from "@/lib/user-block";
import { accountLocks } from "@/lib/sign-in-lock";

export { revokeUserSessions } from "@/lib/user-sessions";
import type { z } from "zod";
import type { listUsersQuerySchema } from "@/lib/validation/schemas";

type ListQuery = z.infer<typeof listUsersQuerySchema>;

/**
 * The outer `user.id`, table-qualified. Drizzle renders a column in a select
 * list unqualified, which inside a correlated subquery silently binds to the
 * *inner* table's `id` instead — a wrong count, or a type error if the two
 * columns disagree. Spelling out the table is what keeps the correlation real.
 */
const OUTER_USER_ID = sql`${user}.${sql.identifier("id")}`;

/** One row of the admin user listing. Never carries anything from `account`. */
export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  /**
   * Whether this account actually has admin access right now — allow-list
   * membership *and* a verified email, the same pair `getAdmin` demands. It is
   * reported, never set: admin-ness lives in ADMIN_EMAILS, out of the database.
   */
  isAdmin: boolean;
  /**
   * Allow-listed address, unverified email — so no admin access. This is not
   * a half-provisioned admin: `npm run create-admin` verifies in the same run
   * and refuses an address already held by an unverified account, telling the
   * operator it came from public sign-up. So this row is someone squatting an
   * address the allow-list names, and it *blocks* provisioning that address
   * until it is removed — which is why it must stay deletable.
   */
  holdsAdminAddress: boolean;
  /**
   * Blocked right now — the flag *and* an expiry that hasn't passed. A block
   * that has lapsed reports false here while `blockedUntil` still says when it
   * ended, so the screen can show the history without implying it is in force.
   */
  blocked: boolean;
  blockedReason: string | null;
  blockedAt: string | null;
  /** ISO expiry, or null for an indefinite block. */
  blockedUntil: string | null;
  /**
   * Seconds of account-wide sign-in lock still to run (see
   * src/lib/sign-in-lock.ts), or 0. This is the automatic backoff, not a
   * block: nobody decided it, it decays on its own, and it is the one an
   * outsider can trigger against someone else's address — which is why an
   * admin can see it and release it.
   */
  signInLockSeconds: number;
  puzzleCount: number;
  solveCount: number;
  /** Unexpired sessions, i.e. devices that can act as this user right now. */
  activeSessions: number;
  createdAt: string;
}

/**
 * Every registered account, newest first. Deliberately unscoped and it
 * surfaces addresses, so it may only ever be reached through `adminProcedure`.
 *
 * The per-user totals are correlated subqueries rather than joins: three
 * one-to-many joins in one statement would multiply the rows out and make
 * every count wrong.
 */
export async function listUsers(
  q: ListQuery,
  now: Date = new Date(),
): Promise<{ rows: AdminUserRow[]; total: number }> {
  const filters = [];
  if (q.q) {
    // Treat the search term literally — escape LIKE metacharacters.
    const term = `%${q.q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(user.email, term), ilike(user.name, term))!);
  }
  if (q.verified !== undefined) filters.push(eq(user.emailVerified, q.verified));
  if (q.blocked !== undefined) {
    filters.push(q.blocked ? BLOCK_ACTIVE_SQL : not(BLOCK_ACTIVE_SQL));
  }
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        blocked: user.blocked,
        blockedReason: user.blockedReason,
        blockedAt: user.blockedAt,
        blockedUntil: user.blockedUntil,
        puzzleCount: sql<number>`(select count(*) from ${puzzles} where ${puzzles.userId} = ${OUTER_USER_ID})::int`,
        solveCount: sql<number>`(select count(*) from ${solveStates} where ${solveStates.userId} = ${OUTER_USER_ID})::int`,
        activeSessions: sql<number>`(select count(*) from ${session} where ${session.userId} = ${OUTER_USER_ID} and ${session.expiresAt} > ${NOW_UTC})::int`,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(q.limit)
      .offset(q.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(user).where(where),
  ]);

  // One extra query for the whole page rather than one per row; the counters
  // live in their own table and are keyed by a digest of the address, so they
  // cannot be joined to `user` in the statement above.
  const locks = await accountLocks(rows.map((r) => r.email), now);

  return {
    rows: rows.map((r) => {
      const allowListed = isAdminEmail(r.email);
      return {
        ...r,
        isAdmin: allowListed && r.emailVerified,
        holdsAdminAddress: allowListed && !r.emailVerified,
        blocked: isBlocked(r, now),
        blockedAt: r.blockedAt?.toISOString() ?? null,
        blockedUntil: r.blockedUntil?.toISOString() ?? null,
        signInLockSeconds: locks.get(r.email) ?? 0,
        createdAt: r.createdAt.toISOString(),
      };
    }),
    total: count,
  };
}

/**
 * The pair every admin-account guard is keyed to comes back: admin-ness is
 * allow-list membership *and* a verified email, so a caller checking only one
 * of them would guard the wrong set of rows.
 */
export async function findUser(id: string) {
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      blocked: user.blocked,
      blockedUntil: user.blockedUntil,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Remove an account. Its sessions, credentials and solve progress go with it
 * (FK cascade); its generated puzzles do not — `puzzles.userId` is
 * `on delete set null`, so shared links keep working and simply become
 * anonymous. Callers must apply the admin-account and self-deletion guards
 * before reaching this; it enforces nothing on its own.
 */
export async function deleteUser(id: string) {
  const [row] = await db
    .delete(user)
    .where(eq(user.id, id))
    .returning({ id: user.id, email: user.email });
  return row ?? null;
}

