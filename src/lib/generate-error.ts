import { ORPCError } from "@orpc/client";

import type { Messages } from "@/lib/i18n";

/**
 * Turn a failed `puzzles.generate` call into a message in the visitor's
 * language. Server messages stay English (logs, direct API callers), so the
 * UI keys off the error code and the `reason` the router attaches.
 */
export function generateErrorMessage(
  err: unknown,
  t: Messages["generateForm"],
): string {
  if (!(err instanceof ORPCError)) return t.errorUnknown;

  if (err.code === "TOO_MANY_REQUESTS") return t.errorRateLimited;

  if (err.code === "UNPROCESSABLE_CONTENT") {
    const reason = (err.data as { reason?: string } | undefined)?.reason;
    if (reason === "no-entries") return t.errorNoEntries;
    if (reason === "no-interlock") return t.errorNoInterlock;
  }

  return t.errorUnknown;
}
