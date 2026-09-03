# Open Crosswords — project guide

Generate random, printable crosswords from a multilingual clue/answer database,
or solve them online via a shareable link. Open source, single Next.js app.

## Architecture (verify against code before relying on it)

- **Next.js App Router** (`src/app/**`), React 19, TypeScript, Tailwind CSS v4.
- **UI primitives** in `src/components/ui/` are shadcn/ui components (config in
  `components.json`) — build forms and controls from these (`Button`, `Input`,
  `Select`, `Table`, `Tabs`, etc.) rather than raw `<button>`/`<input>` with
  ad hoc classes. Theme tokens live in `src/app/globals.css`.
- **Data layer** in `src/db/`: Drizzle ORM schema split by domain under
  `src/db/schema/` (`auth.ts`, `content.ts`, re-exported from `index.ts`); the
  shared client is `src/db/index.ts` using **postgres.js** (`drizzle-orm/postgres-js`)
  against Postgres (Neon in production, local Docker Postgres for dev). Node.js
  runtime only — never `runtime = 'edge'` on a route that touches the DB.
- **Migrations** are committed SQL under `drizzle/`, generated with
  `npm run db:generate` and applied with `npm run db:migrate` (not `db:push`).
- **Business logic** in `src/lib/`: the crossword engine (`src/lib/crossword/**`
  — `normalize`, `select` for smart topic-spread/freshness candidate ranking,
  `generate` for greedy interlock placement, `number` for grid numbering),
  `puzzles.ts` (generate + persist + fetch), `entries.ts` / `import.ts`
  (question-library CRUD and bulk import), `ai/draft.ts` (optional LLM drafting).
- **UI translation** in `src/lib/i18n/`: static `en`/`lt` dictionaries
  (`getMessages`), keyed to the app chrome, not the (separately language-scoped)
  clue/answer library. Site-wide chrome (`layout.tsx`, the landing page) picks
  its locale from the visitor's `Accept-Language` header
  (`getRequestLocale`, server-only); the generate form matches whichever
  content language is selected; the solve/print pages match the puzzle's own
  `languageCode` (`resolveLocale`). Admin UI is not translated. Add a language
  by adding its code to `locales` and a dictionary satisfying `typeof en`.
- **Auth** is better-auth (`src/lib/auth.ts`, catch-all route
  `src/app/api/auth/[...all]/route.ts`, React client `src/lib/auth-client.ts`).
  Email+password only, **public sign-up disabled** — admin logins are created
  with `npm run create-admin`.
- **Authorization model**: the question library is a single shared resource
  managed by admins. "Admin" = a signed-in user whose verified email is in
  `ADMIN_EMAILS` (`src/lib/auth-guard.ts` → `requireAdmin`, wrapped by
  `adminRoute` in `src/lib/api.ts`). Every `src/app/api/admin/**` route is
  admin-gated. Generated puzzles are **public** and addressed by an
  unguessable slug; online solve state lives in the visitor's `localStorage`
  (no per-user rows). There is no per-user-owned data today.
- **Tests**: Vitest. Pure logic has colocated `*.test.ts`; DB/route integration
  tests spin up in-process Postgres via PGlite (`src/test/db.ts`) and apply the
  real `drizzle/` migrations. UI is verified through the running dev server.

## Security requirements

Security is the top priority. Where it conflicts with speed, convenience, or
minimizing diff size, security wins. Every change touching auth, authorization,
external input, or the AI/import paths must meet these before it's done:

- **Authentication & session**: all auth flows go through better-auth — never
  hand-roll session/token/password handling. Session cookies stay `httpOnly`,
  `sameSite: strict`, and `secure` whenever `BETTER_AUTH_URL` is HTTPS. Sign-in
  responses must not reveal whether an account exists (the login form shows one
  generic error).
- **Authorization**: every `src/app/api/admin/**` handler must go through
  `adminRoute` / `requireAdmin` — a valid session **and** a verified email in
  `ADMIN_EMAILS` (fail closed; `npm run create-admin` marks the email verified).
  Never infer admin from a client-supplied value, and never expose a
  library-mutation path outside that gate. If a future
  feature introduces per-user-owned rows, scope every read/write to the
  authenticated user's own id (missing scoping / IDOR is a blocking defect).
- **Input validation**: validate every external input (request bodies,
  query/path params, form fields, env vars, CSV/JSON import text, AI output)
  with Zod at the boundary using `safeParse`, and reject rather than coerce on
  failure. Read bodies via `readJson` in `src/lib/api.ts` (up-front size cap).
  Import is capped (rows and payload size); the AI endpoint is admin-only,
  rate-limited, and disabled when `ANTHROPIC_API_KEY` is unset.
- **Output handling**: rely on React's default escaping — never
  `dangerouslySetInnerHTML` or string-built HTML from user/AI input.
- **Data access**: Drizzle query builder / parameterized queries only — never
  interpolate user input into SQL. Puzzle slugs are server-generated (`nanoid`),
  never derived from client input.
- **Secrets**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ANTHROPIC_API_KEY` live
  only in env vars — never hardcoded, logged, committed, or echoed in responses
  or error messages.
- **Rate limiting**: public puzzle generation and the AI endpoint are rate
  limited (`src/lib/rate-limit.ts`, in-memory — move to a shared store if
  running multiple instances).
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
for App Router handlers, PascalCase for React component files, kebab-case for
other modules, `*.test.ts(x)` colocated with the file under test.

## Keeping docs and agent config in sync

A hook in `.claude/settings.json` flags any code/config change (other than to
README.md, this file, AGENTS.md, or `.claude/**`) and once blocks the end of
that turn with a reminder to check whether docs and the
`.claude/agents` / `.claude/skills` config still reflect the app. Treat it as a
prompt to check, not a mandate to edit — update only what's actually stale.
