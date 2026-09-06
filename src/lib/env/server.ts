import { z } from "zod";
import { envError, publicSchema, type EnvSource } from "./client";

/**
 * The server's environment: the public variables from ./client.ts plus every
 * variable only the server may read. Nothing else in the codebase touches
 * `process.env` for configuration — one place to look for what a deployment has
 * to supply, and one place where a bad value is rejected.
 *
 * Validation runs on every startup: `src/instrumentation.ts` imports this
 * module when the server boots, so a misconfigured deployment fails
 * immediately rather than on the first request that happens to need a value.
 *
 * Import only from server code (route handlers, server components, scripts,
 * drizzle.config.ts) — never from a client component, which would put a
 * connection string and an API key in the browser bundle. Client code imports
 * ./client.ts instead, and eslint.config.mjs bars the components tree from
 * reaching this file at all.
 */
const schema = publicSchema.extend({
  DATABASE_URL: z.url("DATABASE_URL must be a valid connection string"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((raw) =>
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  // The one header the hosting platform sets to the real client address, used
  // to key sign-in rate limiting. Exactly one, never a list: any header this
  // app is willing to read is one an attacker can send when the platform
  // doesn't overwrite it (see src/lib/client-ip.ts). Set it to "" when the app
  // is exposed directly, with nothing in front to overwrite anything — then no
  // header is believed at all and every caller shares one bucket, which is
  // slow for everyone but forges nothing.
  AUTH_IP_HEADER: z
    .string()
    .default("x-vercel-forwarded-for")
    .transform((raw) => raw.trim().toLowerCase()),
  // Addresses or CIDR ranges of the reverse proxies in front of this app, if
  // any. Only set this when the app is reachable *only* through those proxies:
  // it makes `x-forwarded-for` the source instead, walked from the right past
  // the trusted hops. An entry that isn't a valid address or range is rejected
  // rather than ignored — better-auth drops bad entries silently, which would
  // quietly collapse every visitor into one shared rate-limit bucket.
  AUTH_TRUSTED_PROXIES: z
    .string()
    .default("")
    .transform((raw) =>
      raw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(
        z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()], {
          error: "AUTH_TRUSTED_PROXIES entries must be IP addresses or CIDR ranges",
        }),
      ),
    ),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().default("claude-sonnet-5"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof schema>;

/**
 * The checks that depend on more than one variable, or on whether a variable
 * was *stated* at all — which the parsed value can no longer answer, since
 * `.default()` makes an unset variable indistinguishable from one set to the
 * default. They read the raw source instead, so they stay a function of the
 * source rather than of the ambient process.
 */
function withCrossFieldChecks(source: EnvSource) {
  const authIpHeaderStated = source.AUTH_IP_HEADER !== undefined;
  // Trimmed, so "  " reads as the empty statement it becomes after parsing
  // rather than as naming a header. The two questions are deliberately
  // different — "" is a deliberate statement (trust no header) but names none.
  const authIpHeaderNamesOne = (source.AUTH_IP_HEADER ?? "").trim().length > 0;
  const onVercel = source.VERCEL !== undefined;

  return schema
    .refine((v) => !(v.AUTH_TRUSTED_PROXIES.length > 0 && authIpHeaderNamesOne), {
      error:
        "Set AUTH_IP_HEADER or AUTH_TRUSTED_PROXIES, not both — with trusted proxies the address is read from x-forwarded-for and AUTH_IP_HEADER would be silently ignored",
      path: ["AUTH_IP_HEADER"],
    })
    // The default names Vercel's header. Anywhere else, nothing overwrites it,
    // so a caller could send it and rotate the value to escape every rate limit
    // keyed on the caller. Rather than fail open on a deployment that never
    // thought about it, refuse to boot until it is stated: the header the proxy
    // in front actually sets, its address in AUTH_TRUSTED_PROXIES, or "" to
    // trust none.
    //
    // A production `next build` has to state it too, though it answers no
    // requests and never reads the value — the same as DATABASE_URL and
    // BETTER_AUTH_SECRET, which builds already supply as placeholders. There is
    // deliberately no exemption for a build: any signal a build could offer is
    // an environment variable, and an environment variable that switches this
    // check off is one a deployed server can end up carrying — from an .env
    // file that travelled, or a runner that exported its build variables. Next
    // also skips the `register()` hook whenever NEXT_PHASE is the production
    // build phase, so a boot check cannot be relied on to catch that.
    .refine(
      (v) =>
        v.NODE_ENV !== "production" ||
        onVercel ||
        authIpHeaderStated ||
        v.AUTH_TRUSTED_PROXIES.length > 0,
      {
        error:
          'AUTH_IP_HEADER must be set in production outside Vercel: name the header your proxy sets (e.g. "cf-connecting-ip", "x-real-ip"), set AUTH_TRUSTED_PROXIES instead, or set it to "" to trust no header',
        path: ["AUTH_IP_HEADER"],
      },
    );
}

/** Validate a server environment, or throw with every problem listed at once. */
export function parseEnv(source: EnvSource = process.env): Env {
  const parsed = withCrossFieldChecks(source).safeParse(source);
  if (!parsed.success) throw envError(parsed.error);
  return parsed.data;
}

/** The validated environment of this process, parsed once at import. */
export const env = parseEnv();

export const isAiEnabled = () => env.ANTHROPIC_API_KEY.length > 0;
