import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import {
  clearSignInAttempts,
  consumeSignInAttempt,
} from "@/lib/auth-throttle";
import { clientIp } from "@/lib/client-ip";
import { env } from "@/lib/env/server";
import {
  isKnownDevice,
  withKnownDevice,
  KNOWN_DEVICE_COOKIE,
  KNOWN_DEVICE_MAX_AGE_SECONDS,
} from "@/lib/known-device";

const SIGN_IN_PATH = "/sign-in/email";
const SIGN_OUT_PATH = "/sign-out";

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
 * Per-account backoff on top of the address-keyed rate limit configured in
 * ./auth.ts (see ./auth-throttle.ts for the counters themselves). The before
 * hook counts the attempt and refuses it when locked; the after hook releases
 * the caller's counter once a sign-in actually completes, remembers the
 * browser, and forgets it again on the way out. Counting up front is what makes
 * the check and the increment one step: judging here and counting afterwards
 * would let a parallel burst all pass the same stale check.
 */
export const signInThrottleHooks = {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return;
      const email = attemptedEmail(ctx.body);
      if (!email) return;
      const retryAfter = await consumeSignInAttempt(
        email,
        clientIp(ctx.headers ?? new Headers()),
        {
          knownDevice: isKnownDevice(
            await ctx.getSignedCookie(KNOWN_DEVICE_COOKIE, env.BETTER_AUTH_SECRET),
            email,
          ),
        },
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
      if (ctx.path === SIGN_OUT_PATH) {
        // Signing out is this browser saying it is no longer the account's.
        // Nothing here can reach a copy of the cookie on another machine, so
        // dropping it on the way out is the one revocation available.
        // Same attributes the issue path sets, so the delete is subject to the
        // same cross-site restrictions as the cookie it replaces.
        ctx.setCookie(KNOWN_DEVICE_COOKIE, "", {
          httpOnly: true,
          sameSite: "strict",
          secure: env.BETTER_AUTH_URL.startsWith("https://"),
          path: "/",
          maxAge: 0,
        });
        return;
      }
      if (ctx.path !== SIGN_IN_PATH || !isSignedIn(ctx.context.returned)) return;
      const email = attemptedEmail(ctx.body);
      if (!email) return;
      try {
        const cookie = await ctx.getSignedCookie(
          KNOWN_DEVICE_COOKIE,
          env.BETTER_AUTH_SECRET,
        );
        // The same `knownDevice` the before hook judged on, so the release
        // gives back exactly what the attempt was counted against.
        await clearSignInAttempts(
          email,
          clientIp(ctx.headers ?? new Headers()),
          { knownDevice: isKnownDevice(cookie, email) },
        );
        // Remember the browser, so an attacker spending this account's
        // account-wide budget can't shut its owner out.
        await ctx.setSignedCookie(
          KNOWN_DEVICE_COOKIE,
          withKnownDevice(cookie, email),
          env.BETTER_AUTH_SECRET,
          {
            httpOnly: true,
            sameSite: "strict",
            secure: env.BETTER_AUTH_URL.startsWith("https://"),
            path: "/",
            maxAge: KNOWN_DEVICE_MAX_AGE_SECONDS,
          },
        );
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
  };
