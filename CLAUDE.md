# Open Crosswords — project guide

Generate random, printable crosswords from a multilingual clue/answer database,
or solve them online via a shareable link. Open source, single Next.js app.

## Architecture (verify against code before relying on it)

- **Next.js App Router** (`src/app/**`), React 19, TypeScript, Tailwind CSS v4.
  Routes are grouped by audience: `src/app/public/**` (generate form, solve,
  print, sign-up — all public), `src/app/admin/**` (`/admin/login`,
  `/admin/dashboard/**`), `src/app/client/**` (`/client/login`,
  `/client/dashboard`). `/` just redirects to `/public`, and the bare
  `/admin` and `/client` index pages redirect to their own dashboards.
  Every admin view is its own route rather than a tab —
  `/admin/dashboard/{entries,puzzles,languages,users,import,ai}`, with `/admin/dashboard`
  redirecting to the first — so each one is linkable, bookmarkable and
  reload-safe. `src/app/admin/dashboard/layout.tsx` renders the chrome shared
  across views (`AdminShell`) and gates it, but **every page under it repeats
  the `getAdmin()` + redirect itself** — a layout is not an authorization
  boundary, because Next picks where to start rendering from the caller's own
  `Next-Router-State-Tree` header and will skip a parent layout's render
  entirely (`e2e/edge-cases.spec.ts` proves this per view). `getAdmin` is
  `cache()`-wrapped, so repeating it is free. Each page is a server component
  that guards, then renders a thin `*View` client component
  (`src/components/admin/{Entries,Puzzles,Languages,Users,Import,AiDraft}View.tsx`)
  that reads
  `useAdminWorkspace()`. The working language is a
  `?lang=` search param, not component state, so a linked view opens with the
  same working language the sender had; `AdminShell` validates it with `LANGUAGE_CODE`
  and falls back to the first language the library has. The picker for it is
  not chrome: `AdminLanguageBar` reads the workspace context and is rendered by
  the view that needs it — bulk import and AI draft, each below the nav and
  above the panel it governs — so no view inherits a control it has no use for.
  The entries and puzzles listings set the same `?lang=` from their own "Filter
  by language" control, so no view carries two controls for one thing. Those
  listings **open across every language** regardless of `?lang=` — the working
  language governs what a new entry is created in, not what the admin came to
  read — and their "All languages" option returns to that wider view without
  moving the working language. Segment names live in
  `src/components/admin/views.ts` — a plain module, because the
  server-side redirect can't import them from `AdminNav` (`"use client"`).
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
  The Docker image applies them on every container start via its entrypoint
  (`scripts/docker-entrypoint.sh`, opt out with `SKIP_DB_MIGRATE=1`); every
  other host still runs them as its own deploy step.
- **Business logic** in `src/lib/`: the crossword engine (`src/lib/crossword/**`
  — `normalize`, `select` for smart topic-spread/freshness candidate ranking,
  `generate` for greedy interlock placement, `number` for grid numbering,
  `word` for the solve UI's word/cursor geometry shared by `CrosswordGrid`
  and `SolveView`),
  `puzzles/` (generate + persist + fetch + per-user listing, split into
  `types.ts`/`queries.ts`, with the admin-only library-wide listing, rename
  and delete in `admin.ts`), `entries.ts` / `taxonomy.ts` / `import.ts`
  (question-library CRUD, the languages and language-scoped categories it
  files rows under, and bulk import — an entry can be moved between languages,
  but a category can't follow it; `deleteLanguage` drops a language only while
  no entries and no puzzles name it, and locks the language row `for update`
  before counting either — that lock is what blocks a concurrent insert naming
  it, and without it a row landing after the check would be cascaded away with
  the language, since `entries` cascades),
  `users.ts` (the admin account listing plus account deletion and session
  revocation — deleting an account cascades its sessions, credentials and
  solve progress, but `puzzles.userId` is `on delete set null`, so the puzzles
  it generated survive as anonymous ones and no shared link breaks),
  `user-block.ts` (administrative blocking — the `user.blocked` flag with an
  optional `blockedUntil`, where "blocked right now" is always *derived* from
  the pair, by `isBlocked` and its SQL twin `BLOCK_ACTIVE_SQL`, so a timed
  block ends without anything having to run on a schedule),
  `user-sessions.ts` (session revocation on its own, so the sign-in hook can
  reach it without closing an import cycle back through the auth guard),
  `sign-in-lock.ts` (the admin's read and release of the *account-wide* half of
  the sign-in backoff — the per-address half is keyed by a digest of an address
  the app never stores and is unreachable by construction),
  `ai/draft.ts` (optional LLM drafting), `solve-state.ts`
  (per-user solve progress, read/write always scoped to the caller's own id),
  `print-layout.ts` (paper geometry: it sizes each print sheet's cells, clue
  font and clue columns so the puzzle occupies exactly one page and the answer
  key exactly one more — `paper.ts` sizes generated grids from the same box).
- **Input schemas and env** each live in one module. Every Zod schema for an
  external input is in `src/lib/validation/schemas.ts` — procedures import
  from it rather than declaring schemas inline, so each field's limits have a
  single definition. Environment variables are declared once (also Zod) and
  split by audience: `src/lib/env/client.ts` holds the public,
  `NEXT_PUBLIC_`-prefixed contract the browser may see (empty today) and is
  safe to import anywhere, and `src/lib/env/server.ts` extends that schema
  with everything only the server may read, exposed as `env`. Nothing else in
  the repo touches `process.env` for configuration, including
  `drizzle.config.ts` and the `scripts/` entry points. The server file throws
  on invalid config and must never be imported from a client component —
  `eslint.config.mjs` bars `src/components/**` from importing it, since doing
  so would inline the connection string and API key into the browser bundle.
  `src/instrumentation.ts` imports it in Next's `register()` hook so every
  server start validates the whole environment up front, instead of waiting
  for the first request that reads a value; `parseEnv(source)` is the same
  check as a pure function, which is how it is tested.
- **UI translation** in `src/lib/i18n/`: static `en`/`lt` dictionaries
  (`getMessages`), keyed to the app chrome, not the (separately language-scoped)
  clue/answer library. Every page's chrome resolves its locale via
  `getRequestLocale` (server-only): the visitor's explicit choice from the
  `locale` cookie if set (`LanguageSwitcher` in the header, persisted by the
  `setLocale` server action in `src/lib/i18n/actions.ts`, which validates the
  value against `locales` before writing), otherwise the highest-`q` supported
  language in their browser's `Accept-Language` header. That includes the
  solve and print pages, which once read the puzzle's own `languageCode`
  instead — the header's switcher then named one language while the page
  rendered another, and picking the language already displayed did nothing.
  Interface language belongs to the visitor; a puzzle's language stays a
  property of its clues (still shown beside the title). The generate form is
  the one exception: its chrome matches whichever content language is
  selected, so it is next if this mismatch resurfaces. Admin UI is not
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
  counter on a verified successful sign-in and issues the signed known-device
  cookie (`src/lib/known-device.ts`) that exempts that browser from the
  account-wide lock. The same after hook refuses a **blocked** account with a
  403, deliberately *after* the password has verified — deciding earlier would
  answer "does this address exist" to anyone who asked — and drops the session
  better-auth just minted, since a thrown after-hook still emits its
  `Set-Cookie` and a cookie pointing at no row is inert.
- **Authorization model**: two independent identities layered on one
  better-auth session — "admin" (a signed-in user whose verified email is in
  `ADMIN_EMAILS`, checked by `getAdmin`/`requireAdmin` in
  `src/lib/auth-guard.ts`, enforced by `adminProcedure`) and "client" (any
  signed-in user at all — no allow-list, no verified-email requirement,
  checked by `getCurrentUser`/`requireUser`, enforced by `userProcedure`).
  There is deliberately no `role` column on `user` — admin-ness stays
  out-of-band via the allow-list so there's only one source of truth for it.
  The question library stays a single shared resource managed by admins
  (every `admin.*` oRPC procedure is admin-gated, including `admin.puzzles.*`
  — the only listing that spans every client's puzzles and surfaces their
  owner's email, so it must never be reached from anywhere else — and
  `admin.users.*`, which lists every registered account and can delete one,
  revoke its sessions, block or unblock it, or release its account-wide sign-in
  lock). The three actions that *take* access away — delete, revokeSessions,
  block — may never target an administrator: `destructiveTarget` in
  `routers/admin-users.ts` refuses the calling admin's own row and any row that
  is allow-listed **and** verified — the same pair `getAdmin` demands,
  deliberately not membership alone, because
  `create-admin` verifies in the same run and refuses an address an unverified
  account already holds, so an allow-listed-but-unverified row is a public
  sign-up squatting that address and must stay removable or the address can
  never be provisioned. The two *restorative* actions — unblock and
  clearSignInLock — go through `restorativeTarget` instead, which applies
  neither refusal: those refusals exist to stop this screen removing an
  administrator, and applying them to actions that only ever give access back
  would instead make an administrator's lockout unrecoverable from inside the
  app (an address can be blocked before it is allow-listed, `create-admin`
  leaves an existing verified account alone, and the account-wide sign-in lock
  is a lever any outsider can run up against an address they merely know).
  Nothing on that screen can grant or revoke admin-ness, and `emailVerified` is
  deliberately not editable there: verifying an allow-listed address would be a
  privilege-escalation lever — which is also why there is no editable role:
  blocking is the only per-account state the screen writes.
  A **blocked** account keeps existing, keeps its puzzles and keeps its address
  taken, but authorizes nothing: `blockUser` sets the flag and deletes every
  session in one transaction, `getAdmin`/`getCurrentUser` re-read the block from
  the database on every request so a session already in flight goes inert, and
  the sign-in hook refuses a fresh one. better-auth's own `/api/auth/*`
  endpoints do *not* consult the block — safe only while no route can mint a
  session for a blocked account, so enabling `session.cookieCache` or a
  social/password-reset flow means revisiting it.
  Generated puzzles are **public** and addressed by an unguessable
  word-and-number slug (e.g.
  `amber-quiet-otter-canyon-48392174`), and optionally owned by
  the signed-in client who generated them (`puzzles.userId`, nullable —
  anonymous generation stays unowned). Per-user solve progress
  (`solve_states`, one row per `(puzzleId, userId)`) syncs server-side for
  signed-in clients; anonymous solving stays `localStorage`-only, unchanged.
  Every per-user read/write derives the acting user from the session
  (`context.user.id` in a `userProcedure`), never from client-supplied input.
  The header's account menu (`src/components/user-menu.tsx`, behind the
  avatar) is the one place the signed-in address, the Admin entry and sign-out
  live — no dashboard carries its own sign-out button; the header's nav holds
  only destinations (Generate, and My puzzles once signed in). The Admin entry
  is shown only to admins: `layout.tsx` resolves `getAdmin()` server-side and
  passes `isAdmin` down to it. That is presentation only; the `/admin` pages
  and `admin.*` procedures still gate themselves, so never treat the hidden
  entry as an access control.
- **Tests**: Vitest for unit/integration (pure logic has colocated
  `*.test.ts`; DB/procedure integration tests spin up in-process Postgres via
  PGlite (`src/test/db.ts`) and apply the real `drizzle/` migrations — see
  `src/lib/orpc/routers/*.test.ts` for the "mock `@/db` + `@/lib/auth-guard`,
  call the procedure directly via oRPC's `call()`" pattern). Playwright for
  e2e (`e2e/**`, `playwright.config.ts`) — runs against a real Postgres
  (PGlite can't back a separately-spawned `next start` process), seeded by
  `npm run pretest:e2e` (`e2e/seed.ts`, idempotent, scoped to fixed
  `e2e-*@example.com` accounts and two dedicated content languages, `zz` and
  the empty `zy` a spec moves an entry into, so it never touches real
  admin-managed data); `E2E_PORT=<n>` moves the whole run off the default
  3100 when a dev server already holds it — Playwright would otherwise reuse
  that server, which runs with a different `ADMIN_EMAILS` and fails every
  sign-in. `npm run test:e2e` runs both.

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
  path outside that gate. On the page side, every `/admin/**` route guards in
  its own `page.tsx` — a shared `layout.tsx` guard is defence in depth, not a
  boundary, since the caller's `Next-Router-State-Tree` decides which segments
  Next renders and can skip the layout entirely. Per-user-owned rows (`puzzles.userId`,
  `solve_states`) must always be scoped to the id from `context.user`
  (set by `userProcedure` from the verified session) — never from a
  client-supplied id (missing scoping / IDOR is a blocking defect). Account
  blocking stays one-directional in both senses: an action that removes access
  may never target an administrator, and an action that restores it may never
  be withheld from one.
- **Input validation**: validate every external input (procedure inputs,
  form fields, env vars, CSV/JSON import text, AI output) with Zod via
  `.input()` on the procedure (oRPC rejects on failure automatically), and
  reject rather than coerce on failure. Both catch-all routes
  (`src/app/rpc/[[...rest]]/route.ts`, `src/app/api/auth/[...all]/route.ts`)
  also check `Content-Length` up front through `exceedsBodyLimit`
  (`src/lib/body-limit.ts`), each with its own ceiling — a soft cap only, since
  a chunked request carries no such header, so per-field Zod `.max()` limits
  remain the hard limit either way. Import is capped (rows and payload size); the AI
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
  statement (the conditional `onConflictDoUpdate`, whose update is skipped
  while the counter is locked; a separate check would let a parallel burst all
  pass it, and a held-open transaction would queue every sign-in for one
  account on one row lock), attempts must be
  counted for unregistered emails too (otherwise the lock answers "does this
  account exist"), and only a *verified* successful sign-in may clear a counter
  (better-call's body-validation error is a different class from better-auth's,
  so "not an error" is not "success" — treating it as one hands an attacker a
  reset between guesses). The account-wide half of the backoff is a lockout
  lever by construction, so the known-device exemption is part of it, not a
  convenience: without it, anyone who knows an address can hold its owner out.
  That exemption carries two invariants of its own, both in
  `skipsAccountCounter` so they cannot drift apart: it applies only when the
  caller also has a trustworthy address (it trades the account-wide counter for
  the per-address one, and with neither the attempt is counted by nothing —
  note `AUTH_IP_HEADER=""` makes every caller addressless), and
  `clearSignInAttempts` must skip the release on exactly the attempts that
  skipped the increment (releasing what was never counted lets an account
  signed into regularly hold its counter at zero).
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

Subagents return **no explanation** — no narration of what they did, no
rationale, no recap of the files they touched, no "I also noticed" asides. A
subagent's final message is only the answer that was asked for: the requested
value, the list, the verdict, or a bare `done` when the task was a change with
nothing to report. Never explain reasoning unless the task itself is a
question whose answer is an explanation. The same applies to work done in the
main session: do the work, report the result, skip the commentary.

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
