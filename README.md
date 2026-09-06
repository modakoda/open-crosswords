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

The app container migrates its database on every start, so upgrading is just
pulling a newer image. The question library starts empty. To
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

## Run locally

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
| `AUTH_IP_HEADER` | no | The one header the platform sets to the client address, used to key rate limiting (default `x-vercel-forwarded-for`; `cf-connecting-ip` on Cloudflare, `x-real-ip` behind most proxies). The origin must be reachable only through whatever sets it, or a caller can forge it. Empty trusts no header, which puts every visitor in one bucket and lets ten sign-in requests a minute from anyone hold everyone out |
| `AUTH_TRUSTED_PROXIES` | no | Comma-separated IPs/CIDRs of the proxies in front of the app, when they set none of the headers above — `x-forwarded-for` is then read and walked past these hops |
| `ANTHROPIC_API_KEY` | no | Enables the "AI draft" admin panel |
| `AI_MODEL` | no | Model id for AI drafting (default `claude-sonnet-5`) |

Every one of them is declared and validated with Zod under
[`src/lib/env/`](./src/lib/env), the only place in the project that reads
`process.env` for configuration — the app, `drizzle.config.ts` and the scripts
under `scripts/` all go through it. The table above is
[`server.ts`](./src/lib/env/server.ts); [`client.ts`](./src/lib/env/client.ts)
holds the public `NEXT_PUBLIC_` variables the browser may see, and is empty
today. Next.js runs it from
[`src/instrumentation.ts`](./src/instrumentation.ts) on every server start, so a
missing or malformed value fails the boot (or the build) with a message naming
the variable, rather than surfacing later as a runtime error on whichever
request first needed it.

## Deploy

Any host that runs Node.js 20.9+ and can reach a Postgres will serve this app.
Three things hold wherever you put it:

- **Migrations run themselves only in the Docker image.** Its entrypoint
  ([`scripts/docker-entrypoint.sh`](./scripts/docker-entrypoint.sh)) applies
  pending migrations before the app starts serving, and stops the container if
  one fails. Set `SKIP_DB_MIGRATE=1` to turn that off — which you should on
  every replica but the first, since concurrent migrators are not locked
  against each other. Anywhere the image is not what runs (Vercel, a plain
  `next start`), apply them with `npm run db:migrate` against the production
  `DATABASE_URL` on every deploy that adds one.
- **The environment is validated at build time too.** `next build` imports
  server modules, which import [`src/lib/env/server.ts`](./src/lib/env/server.ts), so
  `DATABASE_URL` and `BETTER_AUTH_SECRET` must be present for the build and not
  only at runtime. They only have to be well-formed, not real — the
  [Dockerfile](./Dockerfile) builds with placeholders and takes the real values
  at container start. `AUTH_IP_HEADER` counts as one of them: a build never
  reads an address, but no variable is allowed to switch that check off, so
  state it for the build as well (the Dockerfile passes an empty placeholder).
- **`AUTH_IP_HEADER` must name the header your proxy actually sets.** It is how
  sign-in rate limiting identifies a caller, and the default names Vercel's
  header, so a production boot anywhere else refuses to start until you state
  it. Naming a header nothing overwrites lets a caller forge their own address
  and rotate past every limit.

### Vercel

1. **Provision a Postgres.** Neon through the Vercel Marketplace is the
   shortest path, but any Postgres works. Use the **pooled** connection string.
2. **Import the repository.** Vercel detects Next.js and the default build,
   install and output settings are all correct. Do not switch any route to the
   Edge runtime — the Drizzle client talks to Postgres over TCP and needs
   Node.js.
3. **Set the environment variables** under *Settings → Environment Variables*,
   for Production and for Preview if you want preview deployments to work:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the pooled Postgres connection string |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | `https://your-project.vercel.app`, no trailing slash |
   | `ADMIN_EMAILS` | the email you will sign in to `/admin` with |
   | `ANTHROPIC_API_KEY` | optional, enables the AI drafting panel |

   Leave `AUTH_IP_HEADER` unset. Its default is `x-vercel-forwarded-for`, which
   Vercel overwrites on every request, so a caller cannot forge it.
4. **Apply the migrations.** Vercel will not do it for you. Either run them
   from your machine once per schema change:

   ```bash
   DATABASE_URL="<production pooled url>" npm run db:migrate
   ```

   or fold them into the build by setting the build command to
   `npm run db:migrate && npm run build`. The build command is more convenient,
   but only do it when previews use their own database — otherwise a preview
   build migrates production.
5. **Create the admin login** against the same database. The scripts read
   `.env`, and any variable already exported wins over it:

   ```bash
   DATABASE_URL="<production pooled url>" \
   BETTER_AUTH_SECRET="<production secret>" \
     npm run create-admin -- you@example.com "Your Name" "a-long-password"
   ```

   That email must also be in `ADMIN_EMAILS` before it can reach `/admin`.

### Coolify

Coolify runs the app from the committed [Dockerfile](./Dockerfile), which
already serves on port 3000 and carries a `HEALTHCHECK`. Nothing needs a
persistent volume; all state lives in Postgres.

1. **Add a Postgres database** to your project and copy its *internal*
   connection string, so app-to-database traffic never leaves Coolify's
   network.
2. **Add the application.** Either point it at this Git repository with the
   build pack set to *Dockerfile*, or skip building entirely and use the
   published image `ghcr.io/modakoda/open-crosswords:latest`. Set the exposed
   port to `3000` and attach your domain.
3. **Set the environment variables:**

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the database's internal connection string |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | the public `https://` domain you attached, no trailing slash |
   | `AUTH_IP_HEADER` | `x-real-ip` for Coolify's default Traefik proxy |
   | `ADMIN_EMAILS` | the email you will sign in to `/admin` with |
   | `ANTHROPIC_API_KEY` | optional, enables the AI drafting panel |

   `AUTH_IP_HEADER` is the one worth checking rather than trusting: confirm
   what your proxy actually sets before relying on it. Traefik sets both
   `x-real-ip` and `x-forwarded-for`; Caddy sets only `x-forwarded-for`, in
   which case leave `AUTH_IP_HEADER` empty and put the proxy's address in
   `AUTH_TRUSTED_PROXIES` instead. Setting neither refuses to boot, which is
   deliberate — see the note above.
4. **Migrations need no deploy step.** The image applies them on every start.
   Leave the pre-deployment command empty; if you scale past one instance, set
   `SKIP_DB_MIGRATE=1` on the extra ones and migrate as its own step.
5. **Create the admin login** from Coolify's terminal for the running
   container, then add that email to `ADMIN_EMAILS` and redeploy:

   ```bash
   npm run create-admin -- you@example.com "Your Name" "a-long-password"
   ```

The library starts empty either way. Load the bundled English starter set with
`npm run seed` in the same terminal, or import your own from
`/admin/dashboard` → *Bulk import*.

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
· Vitest (with PGlite for DB tests) · Playwright (e2e). Deploys to Vercel,
Coolify or any Node host (see [Deploy](#deploy)); `docker compose` covers
local dependencies.

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
Every push to `main` also builds the [Dockerfile](./Dockerfile) and publishes it
to `ghcr.io/modakoda/open-crosswords:latest`, tagged with the commit's short SHA
as well ([`.github/workflows/docker-publish.yml`](./.github/workflows/docker-publish.yml)).

See [CLAUDE.md](./CLAUDE.md) for architecture and the security requirements that
gate changes to auth, authorization, SQL, and the import/AI paths.

## License

MIT — see [LICENSE](./LICENSE).
