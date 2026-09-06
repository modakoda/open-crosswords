import { getIP } from "better-auth/api";
import { env } from "@/lib/env";

/**
 * Client-address resolution, shared by better-auth's rate limiting
 * (src/lib/auth.ts), the per-account sign-in backoff, and this app's own
 * limiter (src/lib/rate-limit.ts) so all three key on the same value.
 *
 * Exactly one source is trusted, never a union of candidates: a header this app
 * is willing to read is a header an attacker can send whenever the platform in
 * front doesn't overwrite it, and with several candidates the attacker simply
 * picks the one that outranks the genuine one — rotating it to escape the limit
 * or pinning it to a victim's address to burn that victim's bucket.
 *
 * Default is the platform header (Vercel overwrites it); set AUTH_IP_HEADER for
 * another platform (`cf-connecting-ip`, `x-real-ip`), or AUTH_TRUSTED_PROXIES
 * to read `x-forwarded-for` walked from the right past the named proxies. An
 * empty AUTH_IP_HEADER trusts nothing, which is the honest setting for an
 * origin exposed directly: no header there is worth believing. Know what that
 * costs — with no address to key on, every visitor shares one bucket, so ten
 * sign-in requests a minute from anyone denies sign-in to everyone until the
 * window rolls. Prefer putting a proxy in front and naming its header.
 */
function headerToTrust(): string[] {
  if (env.AUTH_TRUSTED_PROXIES.length > 0) return ["x-forwarded-for"];
  return env.AUTH_IP_HEADER.length > 0 ? [env.AUTH_IP_HEADER] : [];
}

export const ipAddressConfig = {
  ipAddressHeaders: headerToTrust(),
  trustedProxies: env.AUTH_TRUSTED_PROXIES,
};

/**
 * The caller's address, or null when none can be trusted — better-auth's own
 * resolver, so every limiter in the app agrees on the answer. Null means "no
 * trustworthy address", which callers must treat as one shared bucket rather
 * than as a distinct client.
 */
export function clientIp(headers: Headers): string | null {
  return getIP(headers, { advanced: { ipAddress: ipAddressConfig } });
}
