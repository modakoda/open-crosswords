import { parseEnv } from "@/lib/env/server";

/**
 * Runs once each time a server instance starts (dev, `next start`, and every
 * serverless cold start), before any request is handled. Validating the whole
 * configuration here means a missing or malformed variable fails the boot with
 * one clear error, instead of surfacing later on whichever request first
 * reaches the code that reads it. `next start` has already opened its port by
 * then, so the process stays up and every request fails — closed, but it is a
 * healthcheck rather than the process itself that reports the failure.
 *
 * Next skips this hook entirely while NEXT_PHASE is "phase-production-build",
 * so nothing here may be the only enforcement of a rule: the env module applies
 * every check on import as well, and this only guarantees it happens at boot.
 */
export function register() {
  // Only the Node.js runtime serves this app's routes; the edge runtime has no
  // access to the same configuration and nothing here to validate.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  parseEnv(process.env);
}
