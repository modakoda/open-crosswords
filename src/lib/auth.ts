import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  clearSignInAttempts,
  consumeSignInAttempt,
} from "@/lib/auth-throttle";
import { clientIp, ipAddressConfig } from "@/lib/client-ip";
import { env } from "@/lib/env";

const SIGN_IN_PATH = "/sign-in/email";

/** Longest address RFC 5321 allows; anything longer is not a sign-in attempt. */
const MAX_EMAIL_LENGTH = 320;

/**
 * The email of a genuine credential attempt, or null when the body isn't one.
 * A request that couldn't reach password verification anyway — no password, a
 * non-string field, an address no account could have — is not counted, so it
 * can't be used as a cheap way to spend an account's attempt budget.
 */
function attemptedEmail(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const { email, password } = body as { email?: unknown; password?: unknown };
  if (typeof password !== "string" || password.length === 0) return null;
  if (typeof email !== "string") return null;
  return email.length > 0 && email.length <= MAX_EMAIL_LENGTH ? email : null;
}

/**
 * Whether an endpoint's return value is a completed sign-in. Checked
 * positively: better-call throws its own `APIError` class for a body that fails
 * schema validation, which is not an instance of the one better-auth throws, so
 * "not an error I recognize" would treat a malformed request as a success and
 * hand an attacker a way to wipe the backoff between guesses.
 */
function isSignedIn(returned: unknown): boolean {
  if (!returned || typeof returned !== "object" || isAPIError(returned)) {
    return false;
  }
  return "user" in returned && Boolean((returned as { user?: unknown }).user);
}

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
      rateLimit: schema.rateLimit,
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
    // Shared counters in Postgres, not the default per-process memory store:
    // in memory, every serverless instance or container keeps its own tally, so
    // the real ceiling was this limit times the number of live instances and it
    // reset on every cold start.
    storage: "database",
    customRules: {
      "/sign-up/email": { window: 60, max: 10 },
      "/sign-in/email": { window: 60, max: 10 },
    },
  },
  /**
   * Per-account backoff on top of the IP limit above (see ./auth-throttle.ts).
   * The before hook counts the attempt and refuses it when the counters say the
   * account is locked; the after hook releases the caller's counter once a
   * sign-in actually completes. Counting up front is what makes the check and
   * the increment one step: judging in the before hook and counting in the
   * after hook would let a parallel burst all pass the same stale check.
   */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return;
      const email = attemptedEmail(ctx.body);
      if (!email) return;
      const retryAfter = await consumeSignInAttempt(
        email,
        clientIp(ctx.headers ?? new Headers()),
      );
      if (retryAfter > 0) {
        throw new APIError(
          "TOO_MANY_REQUESTS",
          {
            code: "TOO_MANY_FAILED_ATTEMPTS",
            message: "Too many failed sign-in attempts. Please try again later.",
          },
          { "Retry-After": String(retryAfter) },
        );
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH || !isSignedIn(ctx.context.returned)) return;
      const email = attemptedEmail(ctx.body);
      if (!email) return;
      try {
        await clearSignInAttempts(email, clientIp(ctx.headers ?? new Headers()));
      } catch (error) {
        // The sign-in itself succeeded and the session already exists; a
        // failure to release the counter must not turn that into a 500. Worst
        // case the caller waits out a backoff they no longer deserve.
        ctx.context.logger.error(
          "Failed to clear sign-in attempts",
          error instanceof Error ? error.message : error,
        );
      }
    }),
  },
  advanced: {
    cookiePrefix: "open-crosswords",
    ipAddress: ipAddressConfig,
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
