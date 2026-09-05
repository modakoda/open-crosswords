# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo. The full
project guide — architecture, security requirements, testing, conventions — is
in [CLAUDE.md](./CLAUDE.md); read it first. This file is the short version.

## What this is

A single Next.js App Router app that:

1. Builds a random crossword from a multilingual clue/answer library, with
   smart candidate selection (topic spread + freshness), sized to print on a
   chosen paper format (A4 / A5 / US Letter / US Legal, portrait or landscape).
2. Lets people solve that crossword online and share it by link — anonymously,
   or signed in (`/public/sign-up`) to own the puzzles they generate and sync
   solve progress across devices (`/client/dashboard`).
3. Gives admins a UI + bulk import + optional AI drafting to grow the library
   in any language.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (needs `DATABASE_URL`) |
| `npm test` | Vitest (unit + PGlite-backed integration) |
| `npm run test:e2e` | Playwright e2e (needs a real Postgres — auto-seeds fixed test accounts) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run knip` | Find unused files, dependencies, and exports |
| `npm run build` | Production build |
| `npm run db:generate` | Generate SQL migration from `src/db/schema/**` |
| `npm run db:migrate` | Apply committed migrations in `drizzle/` |
| `npm run seed -- [file]` | Load a data file (default `data/seed-en.json`) |
| `npm run import -- <lang> <file.csv\|json>` | Bulk import into one language |
| `npm run create-admin -- <email> <name> <password>` | Provision an admin login |

## Layout

```
src/app/                  routes + pages (App Router)
  rpc/[[...rest]]/        oRPC catch-all — the entire typed API surface
  api/auth/[...all]/      better-auth handler (the one non-oRPC API route)
  public/                 generate form, sign-up, puzzles/[slug] solver + /print
  admin/                  login + dashboard (admin-gated)
  client/                 login + dashboard (any signed-in user)
src/lib/orpc/             router.ts + middleware.ts (adminProcedure/userProcedure) +
                          routers/{public,admin,client}.ts
src/db/schema/            Drizzle schema: auth.ts, content.ts, solve-state.ts
src/lib/crossword/        engine: normalize, select, generate, number, rng
src/lib/                  puzzles/ (types+queries), entries, import, csv, paper,
                          rate-limit, solve-state, ai/
src/lib/i18n/             en/lt UI dictionaries for the visitor- and client-facing pages
src/components/           UI (PascalCase); admin/ and client/ subfolders
src/test/db.ts            PGlite test database helper (Vitest)
e2e/                      Playwright specs + seed.ts (fixed e2e-*@example.com accounts)
data/seed-en.json         starter English question set
data/seed-en-large.json.gz  large English set generated from WordNet (~1.1M entries,
                          gzipped; `npm run seed` gunzips `.gz` paths transparently)
data/seed-lt.json         starter Lithuanian question set
data/seed-lt-hard.json    supplementary hard-difficulty Lithuanian question set
drizzle/                  committed migration SQL
```

## Non-negotiables

- Validate every external input with Zod via `.input()` on the oRPC
  procedure — never a bare, unvalidated request body.
- Every `admin.*` procedure goes through `adminProcedure`
  (`src/lib/orpc/middleware.ts`) → `requireAdmin` (valid session + verified
  email in `ADMIN_EMAILS`, fail closed). Every per-user procedure
  (`client.*`) goes through `userProcedure` → `requireUser`, and scopes every
  read/write to `context.user.id` — never a client-supplied id.
- Drizzle query builder only — no string-built SQL. Puzzle slugs are
  server-generated, never from client input.
- Node.js runtime on any route that touches the DB (never `edge`).
- Keep files under ~200 lines; colocate `*.test.ts(x)`.
- Changes to auth, authorization, raw SQL, or the import/AI input paths need a
  `security-engineer` review before they're done.

## How generation works

`buildCrossword(candidates, opts)` (`src/lib/crossword/index.ts`):

1. `selectCandidates` — filter by language/category, bucket by category, rank
   each bucket by `freshness` (lower `timesUsed`, older `lastUsedAt`) plus light
   seeded jitter, then round-robin across buckets for topic spread.
2. `generateCrossword` — greedy interlock: place the first word, then for each
   remaining candidate try every letter-crossing placement, score by crossings
   minus grid growth, keep the best; stop at `targetWords` or when the pool is
   exhausted. Crop to the bounding box.
3. `assignNumbers` — standard row-major crossword numbering.

Grid `maxSize` / `targetWords` come from `paperToGrid(paperSize, orientation)`
in `src/lib/paper.ts`. A `seed` makes the whole thing reproducible.
