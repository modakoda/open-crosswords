# Open Crosswords

Generate random, **printable** crosswords from a multilingual database of clues
and answers — or solve them online and share the link. One open-source Next.js
app, easy to self-host.

- 🧩 **Smart selection** — each puzzle draws a fresh, topic-spread set of clues
  (favours categories you haven't just used and clues used least/least recently).
- 🖨️ **Print-ready** — pick A4, A5, US Letter or US Legal, portrait or landscape;
  the grid is sized to fit, and the print screen lets you include or omit the
  solved answer key.
- ⌨️ **Solve online** — type into the grid, arrow/Tab navigation, check & reveal,
  progress saved in your browser; every generated puzzle has a shareable URL.
- 🌍 **Any language** — the schema is language-scoped; English ships as the
  starter set. Grow the library with the admin UI, CSV/JSON import, or optional
  AI drafting.

## Quick start

Requires Node.js 20+ and a Postgres database (local Docker or
[Neon](https://neon.tech)).

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL + BETTER_AUTH_SECRET
```

### Option A — local Postgres with Docker

```bash
docker compose up -d          # Postgres on localhost:5433 (see compose.yaml)
npm run db:migrate            # apply migrations
npm run seed                  # load data/seed-en.json (English starter set)
npm run dev                   # http://localhost:3000
```

(There is also a `Tiltfile` — `tilt up` runs Postgres, migrations and the dev
server together with live reload.)

### Option B — Neon

Create a project, put its pooled connection string in `DATABASE_URL`, then:

```bash
npm run db:migrate && npm run seed && npm run dev
```

### Create an admin login

Public sign-up is disabled. Provision an account, then list its email in
`ADMIN_EMAILS`:

```bash
npm run create-admin -- you@example.com "Your Name" "a-long-password"
```

Sign in at `/admin`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | yes | 32-byte random string (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | yes | Public base URL, no trailing slash |
| `ADMIN_EMAILS` | yes | Comma-separated emails allowed into `/admin` |
| `ANTHROPIC_API_KEY` | no | Enables the "AI draft" admin panel |
| `AI_MODEL` | no | Model id for AI drafting (default `claude-sonnet-5`) |

## Adding questions

- **Admin UI** (`/admin` → *Entries*) — add one clue/answer at a time, with an
  optional category and difficulty 1–5.
- **Bulk import** (`/admin` → *Bulk import*, or `npm run import -- <lang> <file>`):
  - JSON: `[{ "clue": "...", "answer": "...", "category": "...", "difficulty": 3 }]`
    (or `{ "entries": [...] }`)
  - CSV: header row with `clue,answer[,category][,difficulty]`
  - Answers are normalised to grid letters (accents folded, non-letters dropped).
    Unknown categories are created automatically; exact duplicates are skipped.
- **AI draft** (`/admin` → *AI draft*, needs `ANTHROPIC_API_KEY`) — describe a
  topic and language, review the suggestions, save the ones you want.

### Add a language

Any BCP-47-ish code (`en`, `lt`, `pt-br`, …) works. Pick or type it in the admin
dashboard and start adding entries, or:

```bash
npm run import -- lt data/my-lithuanian-clues.csv
```

## How a puzzle is built

`src/lib/crossword/` — `selectCandidates` ranks the library by category spread
and freshness; `generateCrossword` greedily interlocks words (scoring by
letter-crossings minus grid growth) inside the paper-derived size bound;
`assignNumbers` applies standard crossword numbering. A `seed` makes it
reproducible. See [AGENTS.md](./AGENTS.md) for detail.

## Tech

Next.js App Router · React 19 · Drizzle ORM + Postgres · better-auth · Zod ·
Tailwind CSS v4 · Vitest (with PGlite for DB tests). Deploys to Vercel or any
Node host; `docker compose` covers local dependencies.

## Development

```bash
npm test           # unit + integration
npm run typecheck
npm run build
```

See [CLAUDE.md](./CLAUDE.md) for architecture and the security requirements that
gate changes to auth, authorization, SQL, and the import/AI paths.

## License

MIT — see [LICENSE](./LICENSE).
