import { createHmac } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { signInAttempt } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Sign-in backoff keyed to the account, layered on better-auth's address-keyed
 * rate limit (see ./auth.ts). That limit caps one address at 10 attempts a
 * minute but puts no ceiling on what a distributed attacker can spend against a
 * single account, so attempts are counted per identifier here too.
 *
 * Two counters, both consulted on every attempt:
 * - PER_CLIENT: this account from this address. Tight, and the one that stops
 *   ordinary guessing. Bounded per address, so an attacker locks themselves
 *   out, not the account's owner. Skipped when no address can be trusted —
 *   lumping every anonymous caller into one bucket would hand anyone a
 *   six-request lockout of any account they can name.
 * - PER_ACCOUNT: this account from anywhere. Loose enough that no real person
 *   reaches it, so it only bites on a distributed run. It is a denial-of-
 *   service lever by nature — anyone who knows an email can spend attempts
 *   against it — which is why the threshold is high and the lock is short.
 *
 * Other deliberate properties:
 * - Attempts are counted for every email, whether or not an account exists, so
 *   the lock can't be used to probe which addresses are registered.
 * - Both counters are read, judged and incremented inside one transaction
 *   holding a row lock on each. The rows are created first, because a lock on
 *   a row that does not exist yet locks nothing and lets a parallel burst all
 *   pass the same check.
 * - An attempt refused by either counter increments neither, so hammering a
 *   locked account can't push its backoff higher, and an attacker driving the
 *   account-wide lock can't run up the owner's own counter through it.
 * - A successful sign-in clears that caller's counter and gives one attempt
 *   back to the account-wide one, so ordinary sign-ins never accumulate toward
 *   a lockout while an attacker's failures still do.
 */

interface Policy {
  /** Attempts allowed before the counter locks. */
  free: number;
  /** Lock earned once `free` attempts are spent; doubles with each one after. */
  base: number;
  /** Ceiling on the backoff. */
  max: number;
}

export const PER_CLIENT: Policy = { free: 5, base: 60, max: 15 * 60 };
export const PER_ACCOUNT: Policy = { free: 100, base: 60, max: 15 * 60 };

/** A run of attempts with nothing new for this long is forgotten. */
export const DECAY_SECONDS = 60 * 60;

/**
 * Chance that counting an attempt also sweeps decayed rows. A row is written
 * for every attempted email, so without a sweep the table grows with each
 * address an attacker tries; amortizing it over writes keeps that bounded
 * without a scheduled job or a delete on every sign-in.
 */
const PRUNE_PROBABILITY = 0.02;

/**
 * Storage key for one counter: an HMAC under BETTER_AUTH_SECRET, so the table
 * holds no addresses. The scope is inside the digest, both to separate the two
 * counters and to keep this derivation from colliding with any other use of the
 * same secret. Emails are normalized the way better-auth looks accounts up
 * (trimmed, lowercased), so "A@x.com " and "a@x.com" share one counter instead
 * of each resetting the other's backoff.
 */
export function attemptKey(scope: string, email: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`sign-in-attempt:${scope}:${email.trim().toLowerCase()}`)
    .digest("hex");
}

/** Seconds of lock earned by a run of `count` attempts under `policy`. */
export function lockSeconds(count: number, policy: Policy): number {
  if (count < policy.free) return 0;
  return Math.min(policy.base * 2 ** (count - policy.free), policy.max);
}

/** One counter to consult for an attempt. */
interface Counter {
  key: string;
  policy: Policy;
}

/** Seconds still to wait given a counter's state before this attempt. */
function remainingLock(
  row: { failedCount: number; lastFailedAt: Date },
  policy: Policy,
  now: Date,
): number {
  // Never negative: a request that waited on the row lock can hold a `now` from
  // before the attempt that just committed, and a negative age would read as
  // time owed on a lock that was never earned.
  const sinceMs = Math.max(now.getTime() - row.lastFailedAt.getTime(), 0);
  if (sinceMs >= DECAY_SECONDS * 1000) return 0;
  const remainingMs = lockSeconds(row.failedCount, policy) * 1000 - sinceMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/**
 * Judge an attempt against every counter and count it against all of them if it
 * is allowed, in one transaction. Each row is materialized before it is locked:
 * `for update` on a row that does not exist yet takes no lock at all, which
 * would let a burst of parallel first attempts read the same empty state and
 * pass together. Rows are locked in key order so two attempts touching the same
 * pair can't deadlock.
 */
async function consume(counters: Counter[], now: Date): Promise<number> {
  // Bound as ISO text with an explicit cast: inside a raw `sql` fragment a
  // value skips the column's driver mapping, and postgres.js serializes a Date
  // with `toString()`, which Postgres cannot parse.
  const decayCutoff = new Date(
    now.getTime() - DECAY_SECONDS * 1000,
  ).toISOString();
  const ordered = [...counters].sort((a, b) => a.key.localeCompare(b.key));

  return db.transaction(async (tx) => {
    let retryAfter = 0;
    for (const counter of ordered) {
      await tx
        .insert(signInAttempt)
        .values({ identifier: counter.key, failedCount: 0, lastFailedAt: now })
        .onConflictDoNothing();
      const [row] = await tx
        .select()
        .from(signInAttempt)
        .where(eq(signInAttempt.identifier, counter.key))
        .for("update");
      if (row) {
        retryAfter = Math.max(retryAfter, remainingLock(row, counter.policy, now));
      }
    }
    if (retryAfter > 0) return retryAfter;

    for (const counter of ordered) {
      await tx
        .update(signInAttempt)
        .set({
          failedCount: sql`case when ${signInAttempt.lastFailedAt} < ${decayCutoff}::timestamp then 1 else ${signInAttempt.failedCount} + 1 end`,
          lastFailedAt: now,
        })
        .where(eq(signInAttempt.identifier, counter.key));
    }
    return 0;
  });
}

/**
 * Count one sign-in attempt and report the seconds the caller must wait, or 0
 * when the attempt may proceed. A null `ip` means no address could be trusted,
 * which leaves only the account-wide counter — one shared per-account bucket
 * for anonymous callers would be a lockout anyone could trigger.
 */
export async function consumeSignInAttempt(
  email: string,
  ip: string | null,
  now: Date = new Date(),
): Promise<number> {
  const counters: Counter[] = [
    { key: attemptKey("account", email), policy: PER_ACCOUNT },
  ];
  if (ip !== null) {
    counters.push({ key: attemptKey(`client:${ip}`, email), policy: PER_CLIENT });
  }

  const retryAfter = await consume(counters, now);
  if (Math.random() < PRUNE_PROBABILITY) await pruneDecayedAttempts(now);
  return retryAfter;
}

/**
 * Release this caller's counter after a verified successful sign-in and hand
 * one attempt back to the account-wide counter. The account-wide counter is
 * never cleared outright: doing that would let a stranger's probe reveal that
 * the owner had just signed in, and letting it only ever grow would lock out an
 * account that many people legitimately sign into.
 */
export async function clearSignInAttempts(
  email: string,
  ip: string | null,
): Promise<void> {
  if (ip !== null) {
    await db
      .delete(signInAttempt)
      .where(eq(signInAttempt.identifier, attemptKey(`client:${ip}`, email)));
  }
  await db
    .update(signInAttempt)
    .set({ failedCount: sql`greatest(${signInAttempt.failedCount} - 1, 0)` })
    .where(eq(signInAttempt.identifier, attemptKey("account", email)));
}

/** Delete rows whose run of attempts has decayed and no longer means anything. */
export async function pruneDecayedAttempts(
  now: Date = new Date(),
): Promise<void> {
  await db
    .delete(signInAttempt)
    .where(
      lt(
        signInAttempt.lastFailedAt,
        new Date(now.getTime() - DECAY_SECONDS * 1000),
      ),
    );
}
