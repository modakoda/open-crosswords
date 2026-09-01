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
 * Client key for rate limiting. Prefers headers set by the hosting platform
 * itself (not forgeable by the client); for a plain `x-forwarded-for` it uses
 * the LAST hop, which the trusted proxy appends, rather than the first token
 * (which the client controls and could rotate to evade the limiter).
 *
 * Deployment assumption: the platform sets one of these headers. If it does
 * not, every caller collapses to the shared `"local"` bucket and the public
 * generate endpoint is throttled globally — deploy behind a proxy that
 * provides a trusted client IP (Vercel does), or replace this with a real
 * shared-store limiter.
 */
export function clientKey(headers: Headers, scope: string): string {
  const trusted =
    headers.get("x-vercel-forwarded-for") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip");
  let ip = trusted?.trim();
  if (!ip) {
    const hops = headers.get("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean);
    ip = hops?.[hops.length - 1];
  }
  return `${scope}:${ip || "local"}`;
}

/** Test helper. */
export function __resetRateLimits() {
  buckets.clear();
}
