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
  // Public sign-up/sign-in are the only unauthenticated write surface this
  // library doesn't already rate-limit itself (cf. src/lib/rate-limit.ts on
  // puzzles.generate / ai-draft) — enabled outside production too so it's
  // consistently in effect, not just an implicit prod-only default.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customRules: {
      "/sign-up/email": { window: 60, max: 10 },
      "/sign-in/email": { window: 60, max: 10 },
    },
  },
  advanced: {
    cookiePrefix: "open-crosswords",
    // Secure whenever the app is served over HTTPS, not just when NODE_ENV
    // happens to be "production".
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
    defaultCookieAttributes: {
      httpOnly: true,
      // No cross-site OAuth flows — strict is safe for both the admin and
      // client sign-in surfaces.
      sameSite: "strict",
    },
  },
  plugins: [nextCookies()],
});
