# Open Crosswords

Generate random, **printable** crosswords from a multilingual database of clues
and answers — or solve them online and share the link. One open-source Next.js
app, easy to self-host.

- 🧩 **Smart selection** — each puzzle draws a fresh, topic-spread set of clues
  (favours categories you haven't just used and clues used least/least recently).
- 🖨️ **Print-ready** — pick A4, A5, US Letter or US Legal, portrait or landscape;
  the puzzle and its clues always land on a single page, with the answer key on
  a page of its own, and the print screen lets you include or omit that key.
- ⌨️ **Solve online** — type into the grid, arrow/Tab navigation, check your
  answers or reveal a word, progress saved in your browser; every generated
  puzzle has a shareable URL. Sign up (`/public/sign-up`) to also save puzzles
  to your account and sync solve progress across devices.
- 🌍 **Any language** — the schema is language-scoped and starts empty. Grow
  the library with the admin UI, CSV/JSON import, or optional AI drafting; an
  English starter set is bundled to import if you want a running start. The
  visitor-facing UI itself (generate, solve, print) is translated into English
  and Lithuanian (`src/lib/i18n/`), matching the puzzle's language; site-wide
  chrome defaults to the visitor's browser language and can be switched from
  the header (persisted in a cookie).

## Try it out (Docker, no build)

No Node, no clone — pulls the prebuilt image and a throwaway Postgres:

```bash
curl -O https://raw.githubusercontent.com/modakoda/open-crosswords/main/compose.tryout.yaml
docker compose -f compose.tryout.yaml up -d
open http://localhost:3000
```

It applies migrations automatically; the question library starts empty. To
sign in to `/admin/dashboard`, create a login and add its email to `ADMIN_EMAILS`:

```bash
docker compose -f compose.tryout.yaml exec app \
  npm run create-admin -- you@example.com "Your Name" "a-long-password"
ADMIN_EMAILS=you@example.com docker compose -f compose.tryout.yaml up -d app
```

Then add clues from `/admin/dashboard` → *Bulk import*, or load the bundled
English starter set: `docker compose -f compose.tryout.yaml exec app npm run seed`.

See the comments in [compose.tryout.yaml](./compose.tryout.yaml) for details
(and for setting your own `BETTER_AUTH_SECRET` before exposing it beyond
localhost). For actual development, use the setup below instead.

## Quick start

Requires Node.js 20.9+ (what Next.js 16 needs) and a Postgres database (local
Docker or [Neon](https://neon.tech)). CI and [`.mise.toml`](./.mise.toml) both
use Node 24 — run `mise install` (or `mise trust` on first use) if you have
[mise](https://mise.jdx.dev) installed.

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL + BETTER_AUTH_SECRET
```

### Option A — local Postgres with Docker

```bash
docker compose up -d          # Postgres on localhost:5433 (see compose.yaml)
npm run db:migrate            # apply migrations
npm run dev                   # http://localhost:3000
```

The question library starts empty. Add clues from `/admin/dashboard` →
*Bulk import*, or run `npm run seed` to load the bundled English starter set
(`data/seed-en.json`). A Lithuanian starter set is also bundled:
`npm run seed -- data/seed-lt.json`, plus a supplementary set of harder,
more obscure clues: `npm run seed -- data/seed-lt-hard.json`. For a much
larger English pool (~1.1M
entries programmatically generated from WordNet — definitions plus
synonym/hypernym/hyponym/meronym/antonym relations; quality is more variable
than the hand-curated starter set, especially in obscure/taxonomic corners),
run `npm run seed -- data/seed-en-large.json.gz` (takes ~30 minutes; `npm run
seed` gunzips `.gz` paths automatically).

(There is also a `Tiltfile` — `tilt up` runs Postgres, migrations and the dev
server together with live reload.)

### Option B — Neon

Create a project, put its pooled connection string in `DATABASE_URL`, then:

```bash
npm run db:migrate && npm run dev
```

### Create an admin login

Admin accounts are always provisioned out-of-band (separate from the public
`/public/sign-up` client accounts). Provision one, then list its email in
`ADMIN_EMAILS`:

```bash
npm run create-admin -- you@example.com "Your Name" "a-long-password"
```

Sign in at `/admin/login`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | yes | 32-byte random string (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | no | Public base URL, no trailing slash (default `http://localhost:3000`) |
| `ADMIN_EMAILS` | no | Comma-separated emails allowed into `/admin/dashboard` (default: none — set this or nobody can sign in) |
| `AUTH_IP_HEADER` | no | The one header the platform sets to the client address, used to key rate limiting (default `x-vercel-forwarded-for`; `cf-connecting-ip` on Cloudflare, `x-real-ip` behind most proxies, empty when the app is exposed directly). The origin must be reachable only through whatever sets it, or a caller can forge it |
| `AUTH_TRUSTED_PROXIES` | no | Comma-separated IPs/CIDRs of the proxies in front of the app, when they set none of the headers above — `x-forwarded-for` is then read and walked past these hops |
| `ANTHROPIC_API_KEY` | no | Enables the "AI draft" admin panel |
| `AI_MODEL` | no | Model id for AI drafting (default `claude-sonnet-5`) |

These are parsed and validated with Zod in [`src/lib/env.ts`](./src/lib/env.ts)
the first time server code imports them, so a missing or malformed value fails
the boot (or the build) with a message naming the variable rather than surfacing
later as a runtime error.

## Adding questions

- **Admin UI** (`/admin/dashboard` → *Entries*) — add one clue/answer at a
  time, with an optional category and difficulty 1–5.
- **Bulk import** (`/admin/dashboard` → *Bulk import*, or
  `npm run import -- <lang> <file>`):
  - JSON: `[{ "clue": "...", "answer": "...", "category": "...", "difficulty": 3 }]`
    (or `{ "entries": [...] }`)
  - CSV: header row with `clue,answer[,category][,difficulty]`
  - Answers are normalised to grid letters (accents folded, non-letters dropped).
    Unknown categories are created automatically; exact duplicates are skipped.
- **AI draft** (`/admin/dashboard` → *AI draft*, needs `ANTHROPIC_API_KEY`) —
  describe a topic and language, review the suggestions, save the ones you want.

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

Next.js App Router · React 19 · oRPC (typed API layer) · Drizzle ORM +
Postgres · better-auth · Zod · Tailwind CSS v4 + shadcn/ui (light/dark theme)
· Vitest (with PGlite for DB tests) · Playwright (e2e). Deploys to Vercel or
any Node host; `docker compose` covers local dependencies.

## Development

```bash
npm test           # unit + integration
npm run typecheck
npm run lint
npm run knip        # unused files/deps/exports
npm run build
npm run test:e2e    # end-to-end (needs a real Postgres — see compose.yaml)
```

GitHub Actions runs typecheck, lint, migrations, the unit suite and the
Playwright suite against a Postgres service container on every push to `main`
and every pull request ([`.github/workflows/test.yml`](./.github/workflows/test.yml)).

See [CLAUDE.md](./CLAUDE.md) for architecture and the security requirements that
gate changes to auth, authorization, SQL, and the import/AI paths.

## License

MIT — see [LICENSE](./LICENSE).
