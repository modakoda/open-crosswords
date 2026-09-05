import { clientIp } from "@/lib/client-ip";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window in-memory rate limiter. Good enough for a single-instance
 * deployment; swap for a shared store (e.g. Upstash) when running multiple
 * instances. Returns whether the call is allowed plus seconds until reset.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfter };
  }
  return { ok: true, remaining: limit - existing.count, retryAfter };
}

/**
 * Client key for rate limiting, from the one address source this deployment
 * trusts (see ./client-ip.ts) — never a union of candidate headers, any of
 * which a caller could send and rotate to escape the limit.
 *
 * Deployment assumption: the platform sets that header. If it does not, every
 * caller collapses to the shared `"local"` bucket and the public generate
 * endpoint is throttled globally — configure AUTH_IP_HEADER or
 * AUTH_TRUSTED_PROXIES for the deployment, or replace this with a real
 * shared-store limiter.
 */
export function clientKey(headers: Headers, scope: string): string {
  return `${scope}:${clientIp(headers) || "local"}`;
}

/** Test helper. */
export function __resetRateLimits() {
  buckets.clear();
}
