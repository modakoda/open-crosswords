import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Central auth instance. Email + password only. Self-registration creates a
 * plain client account (see /public/sign-up) — admin accounts are always
 * created out-of-band with `npm run create-admin`, and reaching /admin still
 * requires both a verified email and membership in ADMIN_EMAILS (see
 * requireAdmin in ./auth-guard); self-serve sign-up never sets emailVerified,
 * so it cannot grant admin access on its own.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    minPasswordLength: 12,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    cookiePrefix: "open-crosswords",
    // Secure whenever the app is served over HTTPS, not just when NODE_ENV
    // happens to be "production".
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
    defaultCookieAttributes: {
      httpOnly: true,
      // Admin-only app with no cross-site OAuth flows — strict is safe here.
      sameSite: "strict",
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
