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
  // doesn't overwrite it (see src/lib/client-ip.ts).
  AUTH_IP_HEADER: z
    .string()
    .default("x-vercel-forwarded-for")
    .transform((raw) => raw.trim().toLowerCase())
    .refine((h) => h.length > 0, "AUTH_IP_HEADER must not be empty"),
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

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const isAiEnabled = () => env.ANTHROPIC_API_KEY.length > 0;
