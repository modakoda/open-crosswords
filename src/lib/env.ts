import { z } from "zod";

/**
 * Server-side environment validation. Import only from server code
 * (route handlers, server components, scripts) — never from a client component.
 */
const schema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((raw) =>
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
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
