---
name: better-auth
description: >-
  Guides and best practices for working with Better Auth, the TypeScript
  authentication framework used in this project (src/lib/auth.ts). Covers
  installation, the Drizzle + Postgres adapter, the Next.js App Router
  route handler and middleware caveats, session management, plugins, the
  CLI, and security hardening. Use when the user mentions "better-auth",
  "betterauth", "auth.ts", "BETTER_AUTH_SECRET", "toNextJsHandler",
  "drizzleAdapter", sign-in/sign-up flows, sessions, OAuth/social login,
  2FA, organizations, or any authentication work in this repo.
metadata:
  source: https://better-auth.com/docs and https://github.com/better-auth/skills
---

# Better Auth

Better Auth is a framework-agnostic TypeScript auth library — no separate hosted auth service. Everything (schema, sessions, OAuth, plugins) lives in your own database and codebase.

**Always verify against current docs before writing code** — this library ships fast and APIs shift between minor versions:

- Docs index: https://better-auth.com/llms.txt (append `.md` to any docs URL for a clean markdown fetch, e.g. `https://better-auth.com/docs/concepts/plugins.md`)
- Check the actual installed/latest version before assuming an API: `npm view better-auth version`, and diff against what's in this repo's `package.json`.

## Setup Flow

1. **Check the current version**: `npm view better-auth version` — don't hardcode a remembered version number, it moves fast.
2. **Install**: `npm install better-auth`
3. **Env vars** (`.env`):
   ```
   BETTER_AUTH_SECRET=<32+ chars, generate with: openssl rand -base64 32>
   BETTER_AUTH_URL=http://localhost:3000
   ```
   Only set `secret`/`baseURL` in code if these env vars aren't used — Better Auth reads them automatically.
4. **Create the server instance** — `src/lib/auth.ts` in this repo (CLI also looks in `./`, `./lib`, `./utils`, or under `./src`):
   ```ts
   import { betterAuth } from "better-auth";
   import { drizzleAdapter } from "better-auth/adapters/drizzle";
   import { db } from "@/db";

   export const auth = betterAuth({
     database: drizzleAdapter(db, { provider: "pg" }),
     emailAndPassword: { enabled: true },
   });
   ```
5. **Mount the route handler** — this repo's Next.js App Router catch-all at `src/app/api/auth/[...all]/route.ts`:
   ```ts
   import { auth } from "@/lib/auth";
   import { toNextJsHandler } from "better-auth/next-js";

   export const { GET, POST } = toNextJsHandler(auth);
   ```
6. **Create the client** — `src/lib/auth-client.ts`:
   ```ts
   import { createAuthClient } from "better-auth/react";

   export const authClient = createAuthClient();
   ```
7. **Generate and run migrations** (see CLI section below) — re-run any time config or plugins change.
8. **Verify**: `GET /api/auth/ok` should return `{ status: "ok" }`.

## Database Adapter: Drizzle + Postgres (this repo's stack)

Import the adapter from the built-in subpath — don't add a separate adapter package for this:

```ts
import { drizzleAdapter } from "better-auth/adapters/drizzle";

drizzleAdapter(db, {
  provider: "pg", // must match the driver: "pg" | "mysql" | "sqlite"
});
```

Config uses the **Drizzle model name**, not the raw table name — if a table is renamed via `schema`, point `modelName`/`fields` at the Drizzle model, not the SQL identifier.

## CLI

The CLI package is `auth` (invoke via `npx auth@latest ...`). `@better-auth/cli` is the old package name and is deprecated on npm ("no longer supported") — don't reach for it in new setups even if you see it in older docs or examples.

```bash
npx auth@latest generate --output src/db/auth-schema.ts   # generate/update the Drizzle schema for auth tables
npx drizzle-kit generate                                   # dev: create the migration file
npx drizzle-kit migrate                                    # apply it (use `drizzle-kit push` only for throwaway local dev)
```

Re-run `generate` (and the migration) any time you add or reconfigure a plugin that adds schema (2FA, organizations, API keys, etc.) — plugin schema isn't picked up automatically.

## Next.js App Router Integration

- **Server Components / Server Actions** — no HTTP round-trip, call the API directly:
  ```ts
  import { auth } from "@/lib/auth";
  import { headers } from "next/headers";

  const session = await auth.api.getSession({ headers: await headers() });
  ```
- **Server Actions that set cookies** (e.g. `signInEmail`) need the `nextCookies` plugin, placed **last** in the plugins array so it can wrap the others:
  ```ts
  import { nextCookies } from "better-auth/next-js";

  export const auth = betterAuth({
    plugins: [/* other plugins */, nextCookies()],
  });
  ```
- **Middleware / route protection** — this is the sharpest edge in the framework:
  - Next.js 16+ (proxy) or 15.2+ middleware with `runtime: "nodejs"`: full database-backed session validation is fine there, no perf penalty.
  - Older Next.js (Edge middleware): you **cannot** query the database. `getSessionCookie()` only checks that a session cookie is *present* — it does **not** validate it, and a cookie can be fabricated. Use it only for an optimistic redirect (e.g. bounce logged-out-looking requests away from `/dashboard`), and always do the real `auth.api.getSession()` check in the page/route handler itself before returning anything sensitive.

## Session Management

```ts
export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days (default)
    updateAge: 60 * 60 * 24, // refresh threshold (default 1 day)
    freshAge: 60 * 5, // "fresh" window for sensitive ops (default 1 day; 0 disables)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
      strategy: "compact", // "compact" (default, smallest) | "jwt" | "jwe" (encrypted)
    },
  },
});
```

- `cookieCache` avoids a DB hit on every `getSession()`/`useSession()` call, but **custom/additional session fields are never cached** — they're always re-fetched from the DB.
- If `secondaryStorage` (Redis, etc.) is configured, sessions live there by default, not in the DB — set `session.storeSessionInDatabase: true` to also persist them there.
- No database + `cookieCache` with `strategy: "jwe"` = fully stateless sessions (cookie-only, no server-side lookup at all).

## Plugins

Import plugins from their dedicated subpath, not the barrel export — this keeps unused plugin code out of the bundle:

```ts
import { twoFactor } from "better-auth/plugins/two-factor";
// not: import { twoFactor } from "better-auth/plugins"
```

Every server plugin that needs client interaction has a matching client plugin registered in `createAuthClient({ plugins: [...] })` (e.g. `twoFactorClient`, `organizationClient`, `adminClient`, `passkeyClient`). Add both together.

Common plugins: `twoFactor`, `organization`, `admin`, `apiKey`, `passkey`, `magicLink`, `emailOtp`, `sso`, `jwt`, `bearer`, `genericOAuth`, `username`, `phoneNumber`, `multiSession`.

Re-run the CLI `generate`/migration step after adding or reconfiguring any plugin that owns database schema.

## Security Checklist

- `BETTER_AUTH_SECRET` is 32+ chars, high entropy, never committed — stored as an env var / secret manager value.
- Rotate secrets with `BETTER_AUTH_SECRETS` (plural) rather than swapping `BETTER_AUTH_SECRET` outright, so existing sessions/data aren't invalidated mid-rotation.
- `trustedOrigins` explicitly lists every legitimate frontend/app origin — the `baseURL` origin is trusted automatically, nothing else is.
- Leave CSRF and origin-header checks enabled (`advanced.disableCSRFCheck`, `advanced.disableOriginCheck`) — only ever disable these with a specific, understood reason, never as a way to "make an error go away."
- `advanced.useSecureCookies: true` in production (HTTPS-only cookies).
- Rate limiting is on by default in production (10s window / 100 req default, stricter for sign-in and password-change); prefer database or secondary (Redis) storage over in-memory so limits survive restarts and work across instances.
- Don't trust a client-supplied user/owner id for authorization — always derive the acting user from `auth.api.getSession()`, matching this repo's convention in [backend-developer.md](../agents/backend-developer.md).

## Gotchas

- **CLI package rename**: use `auth`, not `@better-auth/cli` (deprecated/unsupported on npm) — some older docs/examples and even community skills still reference the old name.
- **Model name vs table name**: adapter config (`modelName`, `fields`) refers to the ORM model name, not the underlying SQL table name.
- **`getSessionCookie()` is not authentication** — it's presence-only, safe for optimistic UI/redirects, never safe as the actual authorization check (see Middleware above).
- **Plugin schema drift**: forgetting to re-run `auth generate`/migrations after adding a plugin causes runtime "table/column does not exist" errors, not a startup error.
- **`drizzle-kit push` vs `generate`+`migrate`**: `push` skips migration files entirely — fine for local dev, never use it against a production database.
