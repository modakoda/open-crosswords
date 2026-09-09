/**
 * How the two independent "this account can't get in" states are described.
 *
 * They are genuinely different things and the screen must not blur them: a
 * block is a decision an admin made and only an admin can lift, while a
 * sign-in lock is the automatic backoff in src/lib/auth-throttle.ts, which
 * nobody chose, decays on its own, and can be run up against an address by
 * anyone who merely knows it.
 */

/** An expiry that has passed reads as no block; the server agrees. */
export interface BlockFields {
  blocked: boolean;
  blockedReason: string | null;
  blockedUntil: string | null;
  signInLockSeconds: number;
}

const dateTimeFormat = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** "until 12 Mar 2026, 14:03" or "indefinitely", plus the operator's note. */
export function blockSummary(u: BlockFields): string {
  const when = u.blockedUntil
    ? `until ${dateTimeFormat.format(new Date(u.blockedUntil))}`
    : "indefinitely";
  return u.blockedReason ? `Blocked ${when} — ${u.blockedReason}` : `Blocked ${when}`;
}

/** Whole minutes, rounded up, so a 90-second lock never reads as "1 min". */
export function lockSummary(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "under a minute" : `about ${minutes} minutes`;
}
