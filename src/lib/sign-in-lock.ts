import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { signInAttempt } from "@/db/schema";
import { PER_ACCOUNT, attemptKey, remainingLock } from "@/lib/auth-throttle";

/**
 * Reading and releasing the *account-wide* half of the sign-in backoff in
 * ./auth-throttle.ts, for the admin user screen.
 *
 * Only that half is reachable from here, and that is the point. The tight
 * per-address counter is what actually stops someone guessing a password, and
 * its rows are keyed by a digest of an address this app never stores, so
 * nothing here can find or clear one. The account-wide counter is the opposite
 * kind of thing: it exists to bound a distributed run, and by construction it
 * is also the lever a stranger can pull to hold a real person out of their
 * account. Letting an admin see that it is engaged, and release it, is the
 * manual answer to exactly that case.
 *
 * A release therefore hands back only the distributed-run budget, never the
 * per-address one, and it is admin-gated. Blocking an account is the opposite
 * action and lives in ./user-block.ts.
 */

/** The lock this account is under right now, in seconds; 0 when it is free. */
export interface AccountLock {
  email: string;
  retryAfterSeconds: number;
}

/**
 * Seconds of account-wide lock for each address, keyed by the address as
 * given. One query for the whole page: a listing of 200 rows must not become
 * 200 round trips.
 *
 * Addresses that have no counter row are simply absent from the result, which
 * reads as unlocked.
 */
export async function accountLocks(
  emails: string[],
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const locks = new Map<string, number>();
  if (emails.length === 0) return locks;

  // Two addresses differing only in case or spacing share one counter, so map
  // key back to every address that produced it rather than assuming a bijection.
  const byKey = new Map<string, string[]>();
  for (const email of emails) {
    const key = attemptKey("account", email);
    byKey.set(key, [...(byKey.get(key) ?? []), email]);
  }

  const rows = await db
    .select()
    .from(signInAttempt)
    .where(inArray(signInAttempt.identifier, [...byKey.keys()]));

  for (const row of rows) {
    const seconds = remainingLock(row, PER_ACCOUNT, now);
    if (seconds <= 0) continue;
    for (const email of byKey.get(row.identifier) ?? []) {
      locks.set(email, seconds);
    }
  }
  return locks;
}

/**
 * Drop the account-wide counter for one address. Returns whether there was one
 * to drop, so the caller can tell "released" from "nothing was locked".
 */
export async function clearAccountLock(email: string): Promise<boolean> {
  const rows = await db
    .delete(signInAttempt)
    .where(eq(signInAttempt.identifier, attemptKey("account", email)))
    .returning({ identifier: signInAttempt.identifier });
  return rows.length > 0;
}
