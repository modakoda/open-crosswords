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
 *   reaches it, so it only bites on a distributed run. On its own it would be a
 *   denial-of-service lever — anyone who knows an email could spend attempts
 *   against it — so besides keeping the threshold high and the lock short, a
 *   browser that has signed in to the account before is exempt from it (see
 *   ./known-device.ts) and keeps getting in while such a run is under way. That
 *   exemption applies only when the caller has a trustworthy address, since it
 *   trades this counter for the per-address one — with neither, an attempt
 *   would go uncounted.
 *
 * Other deliberate properties:
 * - Attempts are counted for every email, whether or not an account exists, so
 *   the lock can't be used to probe which addresses are registered.
 * - Each counter is judged and incremented by one statement whose update only
 *   applies while the counter is unlocked, so a burst of parallel attempts is
 *   serialized by the row's own write lock rather than by a check every one of
 *   them passes. No transaction is held open across round trips: sign-ins for
 *   one account would queue on that row and could starve the connection pool.
 * - An attempt refused by either counter increments neither. The tight counter
 *   is consulted first so a locked-out address can't spend the account-wide
 *   budget, and an attempt the account-wide counter then refuses is handed
 *   back to the tight one.
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
function lockSeconds(count: number, policy: Policy): number {
  if (count < policy.free) return 0;
  return Math.min(policy.base * 2 ** (count - policy.free), policy.max);
}

export interface SignInAttemptOptions {
  /** This browser has completed a sign-in to the account before. */
  knownDevice?: boolean;
  /** Clock for the attempt; injected by tests. */
  now?: Date;
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
  // Never negative: a request can carry a `now` from before the attempt that
  // beat it to the row, and a negative age would read as time owed on a lock
  // that was never earned.
  const sinceMs = Math.max(now.getTime() - row.lastFailedAt.getTime(), 0);
  if (sinceMs >= DECAY_SECONDS * 1000) return 0;
  const remainingMs = lockSeconds(row.failedCount, policy) * 1000 - sinceMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/**
 * The same backoff curve as `lockSeconds`, in SQL, over the stored row. The
 * exponent is clamped because the counter keeps climbing across lock cycles and
 * `power(2, …)` would eventually overflow and fail the statement outright.
 */
function lockIntervalSql(policy: Policy) {
  return sql`make_interval(secs => case
      when ${signInAttempt.failedCount} < ${policy.free} then 0
      else least(
        ${policy.base} * power(2, least(${signInAttempt.failedCount} - ${policy.free}, 20)),
        ${policy.max}
      )
    end)`;
}

/**
 * Judge one attempt against a counter and count it if it is allowed, in a
 * single statement. Postgres re-reads the conflicting row under its write lock
 * before evaluating the update, so parallel attempts are decided one after
 * another against fresh state; the update's `where` is what keeps a locked
 * counter from being incremented, and a statement that updates nothing returns
 * no row, which is how a refusal is recognized here.
 */
async function consume(counter: Counter, now: Date): Promise<number> {
  // Bound as ISO text with an explicit cast: inside a raw `sql` fragment a
  // value skips the column's driver mapping, and postgres.js serializes a Date
  // with `toString()`, which Postgres cannot parse.
  const decayCutoff = new Date(
    now.getTime() - DECAY_SECONDS * 1000,
  ).toISOString();
  const nowIso = now.toISOString();
  const decayed = sql`${signInAttempt.lastFailedAt} < ${decayCutoff}::timestamp`;

  const counted = await db
    .insert(signInAttempt)
    .values({ identifier: counter.key, failedCount: 1, lastFailedAt: now })
    .onConflictDoUpdate({
      target: signInAttempt.identifier,
      set: {
        failedCount: sql`case when ${decayed} then 1 else ${signInAttempt.failedCount} + 1 end`,
        lastFailedAt: now,
      },
      // `greatest` for the same reason `remainingLock` clamps: a row touched
      // after this request started must not read as a lock still running.
      setWhere: sql`${decayed} or ${signInAttempt.lastFailedAt} + ${lockIntervalSql(counter.policy)} <= greatest(${nowIso}::timestamp, ${signInAttempt.lastFailedAt})`,
    })
    .returning({ failedCount: signInAttempt.failedCount });

  if (counted.length > 0) return 0;

  const [row] = await db
    .select()
    .from(signInAttempt)
    .where(eq(signInAttempt.identifier, counter.key));
  // The statement refused this attempt, so a missing row means the counter was
  // cleared or swept in between. Report the shortest lock rather than 0: the
  // decision was "refused", and turning that into "allowed" here would let the
  // race hand back an uncounted attempt.
  return row ? remainingLock(row, counter.policy, now) : counter.policy.base;
}

/**
 * Whether this attempt sits out the account-wide counter: a browser that has
 * signed in to the account before, *and* an address giving it a tight counter
 * of its own to be bounded by. Without a trustworthy address there is no tight
 * counter, so exempting the attempt would leave it counted by nothing at all.
 *
 * Both the increment and the release consult this, because the two must agree:
 * releasing what was never counted would let an account with regular sign-ins
 * hold its account-wide counter at zero and lose the bound entirely.
 */
function skipsAccountCounter(knownDevice: boolean, ip: string | null): boolean {
  return knownDevice && ip !== null;
}

/** Hand back an attempt counted against a counter that then refused elsewhere. */
async function refund(key: string): Promise<void> {
  await db
    .update(signInAttempt)
    .set({ failedCount: sql`greatest(${signInAttempt.failedCount} - 1, 0)` })
    .where(eq(signInAttempt.identifier, key));
}

/**
 * Count one sign-in attempt and report the seconds the caller must wait, or 0
 * when the attempt may proceed. A null `ip` means no address could be trusted,
 * which leaves only the account-wide counter — one shared per-account bucket
 * for anonymous callers would be a lockout anyone could trigger. A known
 * device skips the account-wide counter entirely: it exists to bound strangers
 * guessing, and it must not shut out someone who has signed in here before.
 */
export async function consumeSignInAttempt(
  email: string,
  ip: string | null,
  { knownDevice = false, now = new Date() }: SignInAttemptOptions = {},
): Promise<number> {
  const client: Counter | null =
    ip === null
      ? null
      : { key: attemptKey(`client:${ip}`, email), policy: PER_CLIENT };

  // The tight counter first, so an address already locked out can't go on
  // spending the account-wide budget it shares with everyone else.
  let retryAfter = client ? await consume(client, now) : 0;

  if (retryAfter === 0 && !skipsAccountCounter(knownDevice, ip)) {
    retryAfter = await consume(
      { key: attemptKey("account", email), policy: PER_ACCOUNT },
      now,
    );
    // The tight counter already counted this attempt, but the account-wide one
    // just refused it, so it never happened — hand that one back.
    if (retryAfter > 0 && client) await refund(client.key);
  }

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
  { knownDevice = false }: { knownDevice?: boolean } = {},
): Promise<void> {
  if (ip !== null) {
    await db
      .delete(signInAttempt)
      .where(eq(signInAttempt.identifier, attemptKey(`client:${ip}`, email)));
  }
  // Give back only what this attempt paid in: an exempted attempt never
  // incremented the account-wide counter.
  if (skipsAccountCounter(knownDevice, ip)) return;
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
