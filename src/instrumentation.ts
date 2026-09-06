/**
 * Runs once each time a server instance starts (dev, `next start`, and every
 * serverless cold start). Importing the environment module here parses and
 * validates the whole configuration at boot, so a missing or malformed
 * variable stops the server with one clear error instead of surfacing later,
 * on whichever request first reaches code that reads it.
 */
export async function register() {
  // Only the Node.js runtime serves this app's routes; the edge runtime has no
  // access to the same configuration and nothing here to validate.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  await import("@/lib/env");
}
