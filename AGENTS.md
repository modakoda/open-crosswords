# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo. The full
project guide — architecture, security requirements, testing, conventions — is
in [CLAUDE.md](./CLAUDE.md); read it first. This file is the short version.

## What this is

A single Next.js App Router app that:

1. Builds a random crossword from a multilingual clue/answer library, with
   smart candidate selection (topic spread + freshness), sized to print on a
   chosen paper format (A4 / A5 / US Letter / US Legal, portrait or landscape).
2. Lets people solve that crossword online and share it by link.
3. Gives admins a UI + bulk import + optional AI drafting to grow the library
   in any language.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (needs `DATABASE_URL`) |
| `npm test` | Vitest (unit + PGlite-backed integration) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |
| `npm run db:generate` | Generate SQL migration from `src/db/schema/**` |
| `npm run db:migrate` | Apply committed migrations in `drizzle/` |
| `npm run seed -- [file]` | Load a data file (default `data/seed-en.json`) |
| `npm run import -- <lang> <file.csv\|json>` | Bulk import into one language |
| `npm run create-admin -- <email> <name> <password>` | Provision an admin login |

## Layout

```
src/app/                  routes + pages (App Router)
  api/puzzles/            POST generate (public, rate-limited), GET by slug
  api/admin/**            admin-gated: entries CRUD, import, ai-draft, categories
  api/auth/[...all]/      better-auth handler
  puzzles/[slug]/         online solver  + /print  printable sheet + optional answer key
  admin/                  library dashboard (login-gated)
src/db/schema/            Drizzle schema: auth.ts, content.ts
src/lib/crossword/        engine: normalize, select, generate, number, rng
src/lib/                  puzzles, entries, import, csv, paper, rate-limit, ai/
src/components/           UI (PascalCase); admin/ subfolder for the dashboard
src/test/db.ts            PGlite test database helper
data/seed-en.json         starter English question set
data/seed-lt.json         starter Lithuanian question set
drizzle/                  committed migration SQL
```

## Non-negotiables

- Validate every external input with Zod `safeParse` at the boundary; read
  request bodies with `readJson` from `src/lib/api.ts`, not bare `req.json()`.
- Every `api/admin/**` route goes through `adminRoute` / `requireAdmin` (valid
  session + verified email in `ADMIN_EMAILS`, fail closed).
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
