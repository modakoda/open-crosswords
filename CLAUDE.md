# Open Crosswords — project guide

Generate random, printable crosswords from a multilingual clue/answer database,
or solve them online via a shareable link. Open source, single Next.js app.

## Architecture (verify against code before relying on it)

- **Next.js App Router** (`src/app/**`), React 19, TypeScript, Tailwind CSS v4.
  Routes are grouped by audience: `src/app/public/**` (generate form, solve,
  print, sign-up — all public), `src/app/admin/**` (`/admin/login`,
  `/admin/dashboard`), `src/app/client/**` (`/client/login`,
  `/client/dashboard`). `/` just redirects to `/public`, and the bare
  `/admin` and `/client` index pages redirect to their own dashboards.
- **UI primitives** in `src/components/ui/` are shadcn/ui components (config in
  `components.json`) — build forms and controls from these (`Button`, `Input`,
  `Select`, `Table`, `Tabs`, etc.) rather than raw `<button>`/`<input>` with
  ad hoc classes. Theme tokens live in `src/app/globals.css`.
- **API layer** is oRPC (`@orpc/server`/`@orpc/client`), not REST route
  handlers — a single catch-all route (`src/app/rpc/[[...rest]]/route.ts`)
  mounts an `RPCHandler` built from `src/lib/orpc/router.ts`, which combines
  per-audience routers (`src/lib/orpc/routers/{public,admin,client}.ts`).
  Auth gating is middleware on the procedure builders in
  `src/lib/orpc/middleware.ts` (`adminProcedure` / `userProcedure`), not a
  per-handler wrapper. The browser client is `src/lib/orpc/client.ts`
  (`orpc.<router>.<procedure>(...)` — throws on error, matching the server's
  `ORPCError`). better-auth keeps its own separate catch-all route
  (`src/app/api/auth/[...all]/route.ts`) — oRPC doesn't front auth.
- **Data layer** in `src/db/`: Drizzle ORM schema split by domain under
  `src/db/schema/` (`auth.ts`, `content.ts`, `solve-state.ts`, re-exported from
  `index.ts`); the shared client is `src/db/index.ts` using **postgres.js**
  (`drizzle-orm/postgres-js`) against Postgres (Neon in production, local
  Docker Postgres for dev). Node.js runtime only — never `runtime = 'edge'` on
  a route that touches the DB.
- **Migrations** are committed SQL under `drizzle/`, generated with
  `npm run db:generate` and applied with `npm run db:migrate` (not `db:push`).
- **Business logic** in `src/lib/`: the crossword engine (`src/lib/crossword/**`
  — `normalize`, `select` for smart topic-spread/freshness candidate ranking,
  `generate` for greedy interlock placement, `number` for grid numbering,
  `word` for the solve UI's word/cursor geometry shared by `CrosswordGrid`
  and `SolveView`),
  `puzzles/` (generate + persist + fetch + per-user listing, split into
  `types.ts`/`queries.ts`), `entries.ts` / `import.ts` (question-library CRUD
  and bulk import), `ai/draft.ts` (optional LLM drafting), `solve-state.ts`
  (per-user solve progress, read/write always scoped to the caller's own id),
  `print-layout.ts` (paper geometry: it sizes each print sheet's cells, clue
  font and clue columns so the puzzle occupies exactly one page and the answer
  key exactly one more — `paper.ts` sizes generated grids from the same box).
- **Input schemas and env** each live in one module. Every Zod schema for an
  external input is in `src/lib/validation/schemas.ts` — procedures import
  from it rather than declaring schemas inline, so each field's limits have a
  single definition. Server environment variables are parsed and validated
  once by `src/lib/env.ts` (also Zod) and read through its exported `env`
  object; it throws on invalid config, so import it from server code only,
  never a client component.
- **UI translation** in `src/lib/i18n/`: static `en`/`lt` dictionaries
  (`getMessages`), keyed to the app chrome, not the (separately language-scoped)
  clue/answer library. Site-wide chrome (`layout.tsx`, the public pages, the
  client sign-up/login/dashboard pages) resolves its locale via
  `getRequestLocale` (server-only): the visitor's explicit choice from the
  `locale` cookie if set (`LanguageSwitcher` in the header, persisted by the
  `setLocale` server action in `src/lib/i18n/actions.ts`, which validates the
  value against `locales` before writing), otherwise the highest-`q` supported
  language in their browser's `Accept-Language` header; the generate form
  matches whichever content language is selected; the solve/print pages match
  the puzzle's own `languageCode` (`resolveLocale`). Admin UI is not
  translated. Add a language by adding its code to `locales` and a dictionary
  satisfying `typeof en`.
- **Auth** is better-auth (`src/lib/auth.ts`, catch-all route
  `src/app/api/auth/[...all]/route.ts`, React client `src/lib/auth-client.ts`).
  Email+password only. Public self-serve sign-up is **enabled** (`/public/sign-up`)
  and creates a plain client account — admin accounts are always created
  out-of-band with `npm run create-admin` and are a completely separate
  concept (see Authorization model below), so self-serve sign-up can never
  grant admin access. Sign-up/sign-in are rate-limited via better-auth's own
  `rateLimit` config in `auth.ts` (separate from this app's own
  `src/lib/rate-limit.ts`, used for `puzzles.generate`/`ai-draft`) — keyed to
  the caller's address from `src/lib/client-ip.ts` (one configured header, or
  `x-forwarded-for` when `AUTH_TRUSTED_PROXIES` is set), with counters in
  Postgres (`rate_limit`) rather than per-process memory. Sign-in additionally
  carries an exponential backoff (`src/lib/auth-throttle.ts`,
  `sign_in_attempt`) on two counters: per account-and-caller (tight) and per
  account from anywhere (loose, so only a distributed run reaches it). It is
  wired in as better-auth `hooks.before`/`hooks.after` — the before hook counts
  the attempt and refuses it when locked, the after hook releases the caller's
  counter on a verified successful sign-in.
- **Authorization model**: two independent identities layered on one
  better-auth session — "admin" (a signed-in user whose verified email is in
  `ADMIN_EMAILS`, checked by `getAdmin`/`requireAdmin` in
  `src/lib/auth-guard.ts`, enforced by `adminProcedure`) and "client" (any
  signed-in user at all — no allow-list, no verified-email requirement,
  checked by `getCurrentUser`/`requireUser`, enforced by `userProcedure`).
  There is deliberately no `role` column on `user` — admin-ness stays
  out-of-band via the allow-list so there's only one source of truth for it.
  The question library stays a single shared resource managed by admins
  (every `admin.*` oRPC procedure is admin-gated). Generated puzzles are
  **public** and addressed by an unguessable word-and-number slug (e.g.
  `amber-quiet-otter-canyon-48392174`), and optionally owned by
  the signed-in client who generated them (`puzzles.userId`, nullable —
  anonymous generation stays unowned). Per-user solve progress
  (`solve_states`, one row per `(puzzleId, userId)`) syncs server-side for
  signed-in clients; anonymous solving stays `localStorage`-only, unchanged.
  Every per-user read/write derives the acting user from the session
  (`context.user.id` in a `userProcedure`), never from client-supplied input.
  The header's Admin link is shown only to admins — `layout.tsx` resolves
  `getAdmin()` server-side and passes `isAdmin` to `SiteHeader`. That is
  presentation only; the `/admin` pages and `admin.*` procedures still gate
  themselves, so never treat the hidden link as an access control.
- **Tests**: Vitest for unit/integration (pure logic has colocated
  `*.test.ts`; DB/procedure integration tests spin up in-process Postgres via
  PGlite (`src/test/db.ts`) and apply the real `drizzle/` migrations — see
  `src/lib/orpc/routers/*.test.ts` for the "mock `@/db` + `@/lib/auth-guard`,
  call the procedure directly via oRPC's `call()`" pattern). Playwright for
  e2e (`e2e/**`, `playwright.config.ts`) — runs against a real Postgres
  (PGlite can't back a separately-spawned `next start` process), seeded by
  `npm run pretest:e2e` (`e2e/seed.ts`, idempotent, scoped to fixed
  `e2e-*@example.com` accounts and a dedicated `zz` content language so it
  never touches real admin-managed data). `npm run test:e2e` runs both.

## Security requirements

Security is the top priority. Where it conflicts with speed, convenience, or
minimizing diff size, security wins. Every change touching auth, authorization,
external input, or the AI/import paths must meet these before it's done:

- **Authentication & session**: all auth flows go through better-auth — never
  hand-roll session/token/password handling. Session cookies stay `httpOnly`,
  `sameSite: strict`, and `secure` whenever `BETTER_AUTH_URL` is HTTPS. Sign-in
  responses must not reveal whether an account exists (the login form shows one
  generic error).
- **Authorization**: every `admin.*` oRPC procedure must be built on
  `adminProcedure` (`src/lib/orpc/middleware.ts`), which enforces
  `requireAdmin` — a valid session **and** a verified email in `ADMIN_EMAILS`
  (fail closed; `npm run create-admin` marks the email verified). Never infer
  admin from a client-supplied value, and never expose a library-mutation
  path outside that gate. Per-user-owned rows (`puzzles.userId`,
  `solve_states`) must always be scoped to the id from `context.user`
  (set by `userProcedure` from the verified session) — never from a
  client-supplied id (missing scoping / IDOR is a blocking defect).
- **Input validation**: validate every external input (procedure inputs,
  form fields, env vars, CSV/JSON import text, AI output) with Zod via
  `.input()` on the procedure (oRPC rejects on failure automatically), and
  reject rather than coerce on failure. The RPC route
  (`src/app/rpc/[[...rest]]/route.ts`) also checks `Content-Length` up front
  as a soft global body-size cap; per-field Zod `.max()` limits remain the
  hard limit either way. Import is capped (rows and payload size); the AI
  endpoint is admin-only, rate-limited, and disabled when `ANTHROPIC_API_KEY`
  is unset.
- **Output handling**: rely on React's default escaping — never
  `dangerouslySetInnerHTML` or string-built HTML from user/AI input.
- **Data access**: Drizzle query builder / parameterized queries only — never
  interpolate user input into SQL. Puzzle slugs are server-generated
  (`generatePuzzleSlug` in `src/lib/puzzle-slug.ts` — two adjectives, two nouns
  and an eight-digit number drawn from `node:crypto`, ~56 bits), never derived
  from client input. Nothing rate-limits puzzle reads, so that entropy is the
  only thing standing between a scraper and the whole library — keep it there
  if the format changes again.
- **Secrets**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ANTHROPIC_API_KEY` live
  only in env vars — never hardcoded, logged, committed, or echoed in responses
  or error messages.
- **Rate limiting**: public puzzle generation and the AI endpoint are rate
  limited (`src/lib/rate-limit.ts`, in-memory — move to a shared store if
  running multiple instances); sign-up/sign-in are rate limited separately via
  better-auth's own `rateLimit` config in `src/lib/auth.ts`, whose counters do
  live in Postgres so they hold across instances. Password guessing is bounded
  on two axes and both must stay: per address by that config, and per account
  by the backoff in `src/lib/auth-throttle.ts`. Three properties of that
  backoff are load-bearing — an attempt must be counted and judged in one
  locked step, and the row has to be created before it is locked (`for update`
  on a row that doesn't exist yet locks nothing, and a parallel burst then all
  passes the same empty check), attempts must be
  counted for unregistered emails too (otherwise the lock answers "does this
  account exist"), and only a *verified* successful sign-in may clear a counter
  (better-call's body-validation error is a different class from better-auth's,
  so "not an error" is not "success" — treating it as one hands an attacker a
  reset between guesses).
- **Client address**: anything keyed to "the caller" reads
  `src/lib/client-ip.ts`, which trusts exactly one header. Never widen that to
  a list of candidates: a header the app is willing to read is one a caller can
  send whenever the platform in front doesn't overwrite it, which lets them
  rotate it to escape a limit or pin it to a victim's address to burn that
  victim's bucket.
- **Dependencies**: don't add a package that duplicates a capability already
  covered by better-auth / Drizzle / Zod; check for known-vulnerable versions.
- **Transport & headers**: HTTPS-only in production; never disable TLS
  verification or add permissive CORS (`*`) to an authenticated route.
- **File handling**: there are no file uploads (bulk import is pasted text). If
  uploads are added, validate size/type server-side and derive storage keys
  from server values, never from client input.

Any change touching auth, authorization, raw SQL, or the import/AI input paths
must be reviewed by the `security-engineer` agent before it's treated as done —
a required gate, not an optional pass.

## Response style

Keep responses as short as possible. Skip preamble, restating the request, and
summarizing what was just done unless asked. Answer directly; expand only when
the task genuinely requires it.

## Testing requirements

Every code change must be covered at the right level: unit tests for
functions/modules, integration tests for API routes / DB queries / auth flows
(PGlite-backed), and dev-server verification for user-facing UI flows. A feature
or fix isn't done until its tests exist and pass (`npm test`).

## File size and naming

Keep source files under ~200 lines; split by responsibility when one grows past
that. Follow existing conventions for the file's location and type: `route.ts`
for App Router handlers, kebab-case for non-component modules, and
`*.test.ts(x)` colocated with the file under test. Components are mixed by
origin, and a new file should match its neighbours: feature components are
PascalCase (`CrosswordGrid.tsx`, `admin/EntryTable.tsx`), while the shadcn/ui
primitives in `src/components/ui/` and the site chrome around them
(`site-header.tsx`, `language-switcher.tsx`, `theme-toggle.tsx`) stay
kebab-case.

## Keeping docs and agent config in sync

A hook in `.claude/settings.json` flags any code/config change (other than to
README.md, this file, AGENTS.md, or `.claude/**`) and once blocks the end of
that turn with a reminder to check whether docs and the
`.claude/agents` / `.claude/skills` config still reflect the app. Treat it as a
prompt to check, not a mandate to edit — update only what's actually stale.
