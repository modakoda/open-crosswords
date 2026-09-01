import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

export interface AdminUser {
  id: string;
  email: string;
}

/**
 * Resolve the current session and confirm the user is an allow-listed admin.
 * Returns null when there is no session or the email is not in ADMIN_EMAILS.
 * Every /admin route and /api/admin handler must gate on this.
 */
export async function getAdmin(): Promise<AdminUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) return null;
  const email = session.user.email.toLowerCase();
  // Fail closed: an admin account must have a verified email. `npm run
  // create-admin` sets this on provisioning; do not weaken it by environment.
  if (!session.user.emailVerified) return null;
  if (!env.ADMIN_EMAILS.includes(email)) return null;
  return { id: session.user.id, email };
}

export class ForbiddenError extends Error {}

/** Throws ForbiddenError if the caller is not an admin. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new ForbiddenError("Admin access required");
  return admin;
}
