import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env/server";
import { isUserBlocked } from "@/lib/user-block";

export interface AdminUser {
  id: string;
  email: string;
}

/**
 * Resolve the current session and confirm the user is an allow-listed admin.
 * Returns null when there is no session, the email is not in ADMIN_EMAILS, or
 * the account is blocked.
 * Every /admin route and /api/admin handler must gate on this.
 *
 * React `cache` de-dupes this per request only (the root layout and the page
 * both ask) — it never spans requests, so no session state crosses viewers.
 */
export const getAdmin = cache(async function getAdmin(): Promise<AdminUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) return null;
  const email = session.user.email.toLowerCase();
  // Fail closed: an admin account must have a verified email. `npm run
  // create-admin` sets this on provisioning; do not weaken it by environment.
  if (!session.user.emailVerified) return null;
  if (!isAdminEmail(email)) return null;
  // A blocked account authorizes nothing, whatever else is true of it. Read
  // from the database rather than from the session payload: better-auth owns
  // that payload and need not carry columns it doesn't know about.
  if (await isUserBlocked(session.user.id)) return null;
  return { id: session.user.id, email };
});

/**
 * Allow-list membership on its own — the out-of-band half of admin-ness.
 * `getAdmin` layers a live session and a verified email on top, so this is
 * never sufficient to authorize anything; it exists so the one place that
 * knows what ADMIN_EMAILS means is shared with the screens that must *report*
 * or *protect* admin accounts (see src/lib/users.ts).
 */
export function isAdminEmail(email: string): boolean {
  return env.ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export class ForbiddenError extends Error {}

/** Throws ForbiddenError if the caller is not an admin. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new ForbiddenError("Admin access required");
  return admin;
}

export interface CurrentUser {
  id: string;
  email: string;
}

/**
 * Resolve the current session for any signed-in client (no allow-list, no
 * email-verification requirement — unlike admin). Returns null if signed out.
 * Per-request memoized like getAdmin; the cache never spans requests.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) return null;
  // Same rule as getAdmin: a block makes every session of that account inert,
  // including ones minted before the block landed.
  if (await isUserBlocked(session.user.id)) return null;
  return { id: session.user.id, email: session.user.email.toLowerCase() };
});

/** Throws ForbiddenError if the caller is not signed in. */
export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) throw new ForbiddenError("Sign-in required");
  return current;
}
