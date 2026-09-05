import { createHmac } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { signInAttempt } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Sign-in backoff keyed to the account, layered on better-auth's IP-keyed rate
 * limit (see ./auth.ts). That limit caps one address at 10 attempts a minute
 * but puts no ceiling on what a distributed attacker can spend against a single
 * account, so attempts are counted per identifier here too.
 *
 * Two counters, both consumed on every attempt:
 * - PER_CLIENT: this account from this address. Tight, and the one that stops
 *   ordinary guessing. Bounded per address, so an attacker can only lock
 *   themselves out, not a victim.
 * - PER_ACCOUNT: this account from anywhere. Loose enough that no real person
 *   reaches it, so it only bites on a distributed attack. It is a denial-of-
 *   service lever by nature — anyone who knows an email can spend attempts
 *   against it — which is why the threshold is high and the lock is short.
 *
 * Other deliberate properties:
 * - Attempts are counted for every email, whether or not an account exists, so
 *   the lock can't be used to probe which addresses are registered.
 * - An attempt is counted and judged in one statement, so a burst of parallel
 *   attempts can't all read the same pre-increment count and pass together.
 * - An attempt refused by the lock is not counted, so hammering a locked
 *   account doesn't extend the lock.
 * - Only the PER_CLIENT counter is cleared on success, so a stranger can't
 *   learn from a probe whether the owner has signed in lately.
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

/** Seconds still to wait given the counter's state before this attempt. */
function remainingLock(
  prior: { failedCount: number; lastFailedAt: Date } | undefined,
  policy: Policy,
  now: Date,
): number {
  if (!prior) return 0;
  const sinceMs = now.getTime() - prior.lastFailedAt.getTime();
  if (sinceMs >= DECAY_SECONDS * 1000) return 0;
  const remainingMs = lockSeconds(prior.failedCount, policy) * 1000 - sinceMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/**
 * Count one attempt against a counter and report how long it must wait. The
 * read takes a row lock the write then uses, so a burst of parallel attempts is
 * serialized instead of every one of them judging the same pre-increment count.
 * An attempt that arrives locked is refused without being counted, so hammering
 * a locked counter cannot push its backoff any higher.
 */
async function consume(
  key: string,
  policy: Policy,
  now: Date,
): Promise<number> {
  // Bound as ISO text with an explicit cast: inside a raw `sql` fragment a
  // value skips the column's driver mapping, and postgres.js serializes a Date
  // with `toString()`, which Postgres cannot parse.
  const decayCutoff = new Date(
    now.getTime() - DECAY_SECONDS * 1000,
  ).toISOString();

  return db.transaction(async (tx) => {
    const [prior] = await tx
      .select()
      .from(signInAttempt)
      .where(eq(signInAttempt.identifier, key))
      .for("update");

    const retryAfter = remainingLock(prior, policy, now);
    if (retryAfter > 0) return retryAfter;

    await tx
      .insert(signInAttempt)
      .values({ identifier: key, failedCount: 1, lastFailedAt: now })
      .onConflictDoUpdate({
        target: signInAttempt.identifier,
        set: {
          failedCount: sql`case when ${signInAttempt.lastFailedAt} < ${decayCutoff}::timestamp then 1 else ${signInAttempt.failedCount} + 1 end`,
          lastFailedAt: now,
        },
      });
    return 0;
  });
}

/**
 * Count one sign-in attempt on both counters and report the seconds the caller
 * must wait, or 0 when the attempt may proceed. `ip` is null when no address
 * can be trusted, which puts those callers in one shared bucket rather than
 * letting an unattributable attempt escape the per-client counter.
 */
export async function consumeSignInAttempt(
  email: string,
  ip: string | null,
  now: Date = new Date(),
): Promise<number> {
  const perClient = await consume(
    attemptKey(`client:${ip ?? "unknown"}`, email),
    PER_CLIENT,
    now,
  );
  const perAccount = await consume(attemptKey("account", email), PER_ACCOUNT, now);

  if (Math.random() < PRUNE_PROBABILITY) await pruneDecayedAttempts(now);
  return Math.max(perClient, perAccount);
}

/**
 * Clear this caller's backoff after a verified successful sign-in. The
 * account-wide counter is deliberately left to decay on its own: clearing it
 * would tell anyone probing the account that its owner had just signed in.
 */
export async function clearSignInAttempts(
  email: string,
  ip: string | null,
): Promise<void> {
  await db
    .delete(signInAttempt)
    .where(eq(signInAttempt.identifier, attemptKey(`client:${ip ?? "unknown"}`, email)));
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
