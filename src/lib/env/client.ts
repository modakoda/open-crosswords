import { z } from "zod";

/**
 * The half of the environment the browser is allowed to see, safe to import
 * from anywhere — a client component, a server component, a script. It holds
 * no secrets by construction: everything here ends up inlined into the
 * JavaScript sent to every visitor.
 *
 * Its counterpart is ./server.ts, which adds the variables only the server may
 * read (connection strings, keys, the admin list) and must never be imported
 * from client code. The server file builds on this schema, so a variable
 * declared here is validated on both sides from one definition.
 */

/** Anything shaped like `process.env`. */
export type EnvSource = Record<string, string | undefined>;

/**
 * Public configuration. Every entry must be `NEXT_PUBLIC_`-prefixed — that
 * prefix is what lets Next expose it to the browser, and writing an unprefixed
 * variable here would simply read as missing there.
 *
 * Empty today: nothing in the UI is configurable per deployment. The auth
 * client talks to its own origin, and the puzzle, locale and AI settings are
 * all resolved server-side.
 */
export const publicSchema = z.object({
  // Add public variables here, e.g.:
  //   NEXT_PUBLIC_SITE_NAME: z.string().default("Open Crosswords"),
});

export type PublicEnv = z.infer<typeof publicSchema>;

/**
 * One error listing every problem at once. Variable names and rule messages
 * only — never values, which on the server side hold secrets.
 */
export function envError(error: z.ZodError): Error {
  const issues = error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  return new Error(`Invalid environment configuration:\n${issues}`);
}

/**
 * Written out one variable per line rather than read from `process.env` as a
 * whole: in the browser bundle Next substitutes only the full literal
 * `process.env.NEXT_PUBLIC_NAME` where it appears in the source, so a dynamic
 * lookup would find nothing there. Add each new variable to this object as
 * well as to the schema above.
 */
export const publicSource: EnvSource = {
  // NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
};

/** Validate the public half, or throw with every problem listed at once. */
export function parseClientEnv(from: EnvSource = publicSource): PublicEnv {
  const parsed = publicSchema.safeParse(from);
  if (!parsed.success) throw envError(parsed.error);
  return parsed.data;
}

/** Validated on import, which in the browser means on every page load. */
export const clientEnv: PublicEnv = parseClientEnv();
