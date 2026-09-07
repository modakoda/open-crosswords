import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { puzzles, session, solveStates, user } from "@/db/schema";
import { isAdminEmail } from "@/lib/auth-guard";
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
  /** Allow-listed but not yet verified — provisioned, no access yet. */
  isPendingAdmin: boolean;
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
): Promise<{ rows: AdminUserRow[]; total: number }> {
  // `session.expires_at` is a naive `timestamp`, so comparing it to `now()`
  // would be read in the database server's own time zone and mis-classify
  // every session by that offset. Binding the instant here compares the same
  // clock the sessions were written with.
  const now = new Date();
  const filters = [];
  if (q.q) {
    // Treat the search term literally — escape LIKE metacharacters.
    const term = `%${q.q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(user.email, term), ilike(user.name, term))!);
  }
  if (q.verified !== undefined) filters.push(eq(user.emailVerified, q.verified));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        puzzleCount: sql<number>`(select count(*) from ${puzzles} where ${puzzles.userId} = ${OUTER_USER_ID})::int`,
        solveCount: sql<number>`(select count(*) from ${solveStates} where ${solveStates.userId} = ${OUTER_USER_ID})::int`,
        activeSessions: sql<number>`(select count(*) from ${session} where ${session.userId} = ${OUTER_USER_ID} and ${session.expiresAt} > ${now})::int`,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(q.limit)
      .offset(q.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(user).where(where),
  ]);

  return {
    rows: rows.map((r) => {
      const allowListed = isAdminEmail(r.email);
      return {
        ...r,
        isAdmin: allowListed && r.emailVerified,
        isPendingAdmin: allowListed && !r.emailVerified,
        createdAt: r.createdAt.toISOString(),
      };
    }),
    total: count,
  };
}

/** The email is what every admin-account guard is keyed to, so it comes back. */
export async function findUser(id: string) {
  const [row] = await db
    .select({ id: user.id, email: user.email, name: user.name })
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

/**
 * Drop every session row for an account, signing it out everywhere. Expired
 * rows are deleted too — they are dead weight, and counting only live ones
 * would report a number the admin can't reconcile with the listing.
 */
export async function revokeUserSessions(id: string) {
  const rows = await db
    .delete(session)
    .where(eq(session.userId, id))
    .returning({ id: session.id });
  return rows.length;
}
