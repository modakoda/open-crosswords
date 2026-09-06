import { z } from "zod";

/**
 * Server-side environment validation. Import only from server code
 * (route handlers, server components, scripts) — never from a client component.
 */
const schema = z.object({
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

// The checks below turn on whether AUTH_IP_HEADER was *stated*, which the
// parsed value can no longer answer: `.default()` makes an unset variable
// indistinguishable from one set to the default. So they read the raw
// environment. The two questions are deliberately different — "" is a
// deliberate statement (trust no header) but names no header.
const authIpHeaderStated = process.env.AUTH_IP_HEADER !== undefined;
// Trimmed, so "  " reads as the empty statement it becomes after parsing
// rather than as naming a header.
const authIpHeaderNamesOne = (process.env.AUTH_IP_HEADER ?? "").trim().length > 0;
const onVercel = process.env.VERCEL !== undefined;

// `next build` imports server modules to collect route metadata, and does it
// with NODE_ENV already "production". A build answers no requests, so it has no
// caller to identify and nothing to decide about headers — only a running
// server does. Without this, `npm run build` and the Dockerfile's build stage
// would both have to be handed a placeholder for a value they never read.
// NEXT_RUNTIME is set in a serving process and not while collecting build
// metadata, so requiring its absence keeps a stray NEXT_PHASE in a deployed
// environment from switching the guard off on a server that does take requests.
const isProductionBuild =
  process.env.NEXT_PHASE === "phase-production-build" &&
  process.env.NEXT_RUNTIME === undefined;

const parsed = schema
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
  .refine(
    (v) =>
      v.NODE_ENV !== "production" ||
      isProductionBuild ||
      onVercel ||
      authIpHeaderStated ||
      v.AUTH_TRUSTED_PROXIES.length > 0,
    {
      error:
        'AUTH_IP_HEADER must be set in production outside Vercel: name the header your proxy sets (e.g. "cf-connecting-ip", "x-real-ip"), set AUTH_TRUSTED_PROXIES instead, or set it to "" to trust no header',
      path: ["AUTH_IP_HEADER"],
    },
  )
  .safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const isAiEnabled = () => env.ANTHROPIC_API_KEY.length > 0;
