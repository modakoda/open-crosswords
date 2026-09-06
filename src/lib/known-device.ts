import { attemptKey } from "@/lib/auth-throttle";

/**
 * A browser's proof that it has signed in to an account before, used to exempt
 * it from the account-wide sign-in lock (see ./auth-throttle.ts). That lock is
 * what bounds a distributed guessing run, but on its own it also lets an
 * attacker who knows an address hold its owner out; someone who has actually
 * signed in should keep getting in while such a run is under way.
 *
 * The cookie is set by better-auth's signed-cookie helper, so its contents
 * can't be forged, and it holds keyed digests rather than addresses. It is not
 * a credential and grants nothing on its own: a caller presenting one still
 * faces the per-address backoff and the request rate limit, so a stolen cookie
 * buys no extra guesses — only the assurance of not being collateral damage.
 *
 * It is dropped on sign-out and expires on its own, but a copy on some other
 * browser can't be revoked from here: nothing in the digest changes when the
 * password does. That is the reason the exemption is narrow by construction —
 * a stale cookie skips one counter and is still bounded by the other.
 */
// Namespaced by hand. better-auth's `advanced.cookiePrefix` only reaches the
// cookies better-auth itself names; better-call passes this one through
// unchanged, so without the prefix this would be the single cookie the app sets
// outside its own namespace.
export const KNOWN_DEVICE_COOKIE = "open-crosswords.known_device";

/**
 * How long a browser stays known. Long enough to cover the gaps between real
 * sign-ins, short enough that a machine someone no longer uses forgets them,
 * since a password change can't reach a cookie sitting in another browser.
 */
export const KNOWN_DEVICE_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

/** Accounts remembered per browser, so a shared machine keeps working. */
const MAX_REMEMBERED = 5;

/**
 * What better-auth's `getSignedCookie` hands back: the value, or `false` when
 * the cookie is absent or its signature doesn't check out.
 */
type SignedCookie = string | null | false;

/**
 * better-call signs the value alone, so a signature is valid for that value
 * under any cookie name. Naming this cookie inside the digest keeps a value
 * signed for some other purpose from ever reading as a device record here.
 */
const digest = (email: string) => attemptKey(`device:${KNOWN_DEVICE_COOKIE}`, email);

/** The digests a cookie carries; empty for one that is missing or unreadable. */
function remembered(cookie: SignedCookie): string[] {
  return typeof cookie === "string" ? cookie.split(".").filter(Boolean) : [];
}

/** Whether this cookie value vouches for the account being attempted. */
export function isKnownDevice(cookie: SignedCookie, email: string): boolean {
  return remembered(cookie).includes(digest(email));
}

/** The cookie value that adds this account to the ones a browser is known for. */
export function withKnownDevice(cookie: SignedCookie, email: string): string {
  const mine = digest(email);
  const others = remembered(cookie).filter((d) => d !== mine);
  return [mine, ...others].slice(0, MAX_REMEMBERED).join(".");
}
