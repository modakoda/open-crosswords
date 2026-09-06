import { parseEnv } from "@/lib/env";

/**
 * Runs once each time a server instance starts (dev, `next start`, and every
 * serverless cold start), before any request is handled. Validating the whole
 * configuration here means a missing or malformed variable fails the boot with
 * one clear error, instead of surfacing later on whichever request first
 * reaches the code that reads it. `next start` has already opened the port by
 * then, so the process stays up and every request fails — closed, but a
 * healthcheck rather than the process is what reports it.
 *
 * `serving` says this process answers requests, so the checks a build is
 * excused from — a build identifies no callers — apply here in full, even if
 * the build flag somehow reached a deployed environment.
 */
export function register() {
  // Only the Node.js runtime serves this app's routes; the edge runtime has no
  // access to the same configuration and nothing here to validate.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  parseEnv(process.env, { serving: true });
}
