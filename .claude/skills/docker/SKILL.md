---
name: docker
description: >-
  Guides and best practices for Docker and Docker Compose in this project —
  writing a production Dockerfile for the Next.js App Router app, local
  development stacks with Docker Compose, image security hardening, and how
  containerized self-hosting relates to this project's default Vercel
  deployment. Use when the user mentions "Docker", "Dockerfile", "docker
  compose"/"docker-compose", "container", "self-host", "standalone build",
  ".dockerignore", or wants to run this app or its dependencies (e.g. a local
  Postgres) in containers.
metadata:
  applies_to: this repo's Next.js / Drizzle / Neon / better-auth stack
---

# Docker & Docker Compose

This project deploys to Vercel by default (see the `vercel-platform-engineer` agent and `vercel:*` skills). Docker matters here for two separate, non-overlapping use cases — always establish which one is in play before writing anything:

1. **Self-hosting the app** — building a production image of the Next.js app to run outside Vercel (e.g. on a VPS, ECS, Kubernetes). This is the Dockerfile use case.
2. **Local development stack** — running dependent services (a local Postgres, a mail catcher, etc.) alongside `next dev` running natively on the host. This is the Compose use case, and it does **not** normally containerize the app itself in dev — hot reload through a bind mount is slower and flakier than running `next dev`/`bun dev` directly.

Check `next.config.*` and the repo root for an existing `Dockerfile`/`compose.yaml` before assuming either is greenfield.

## Dockerfile: Next.js production image

Next.js needs `output: 'standalone'` in `next.config.*` to produce a minimal, self-contained server (`server.js` + only the `node_modules` actually used) — without it, the image ships the entire `node_modules` tree. Add it if it's missing and a container build is genuinely wanted:

```js
// next.config.ts
const nextConfig = {
  output: 'standalone',
};
```

Multi-stage build, pinned base image, non-root runtime user:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

Rules that matter for this stack:

- **Pin the base image tag** (`node:22-alpine`, not `node:alpine`/`node:latest`) so builds are reproducible; bump deliberately, not implicitly on every rebuild.
- **Order matters for cache**: copy lockfile + `package.json` and `npm ci` *before* copying the rest of the source, so dependency layers only invalidate when dependencies actually change.
- **Use `npm ci`, not `npm install`**, in the deps stage — it's reproducible from the lockfile and fails loudly on drift (swap for `bun install --frozen-lockfile` if this repo has moved to Bun — check the `bun` skill and for a `bun.lock`/`bun.lockb`).
- **Never `COPY .env*` or bake secrets into layers.** `BETTER_AUTH_SECRET`, the Neon `DATABASE_URL`, and any OAuth client secrets are runtime env vars injected by the container platform (`-e`/`--env-file` outside version control, or the orchestrator's secret store) — not build args, and not committed into the image. A build ARG ends up cacheable/inspectable in image history; don't use ARG for anything sensitive.
- **Run as a non-root user** (`nextjs` above) — the Next.js standalone server doesn't need root.
- **Add a `.dockerignore`** at the repo root (`node_modules`, `.next`, `.git`, `.env*`, `*.md`) so the build context stays small and secrets/state never even reach the daemon:
  ```
  node_modules
  .next
  .git
  .env
  .env.*
  npm-debug.log
  ```
- **better-auth's `BETTER_AUTH_URL`** must match the externally-reachable URL of the container (behind whatever reverse proxy/load balancer sits in front) — a mismatch breaks OAuth callbacks and cookie domains silently.
- Add a `HEALTHCHECK` (or rely on the orchestrator's own health probe hitting `/api/auth/ok` or a dedicated `/api/health` route) so a broken container is detected instead of serving 500s indefinitely.

## Docker Compose: local dependency stack

Compose earns its place here for services this project depends on but doesn't run natively — most commonly a local Postgres standing in for Neon during offline development (Neon itself is fully managed; you don't run it in Compose). Keep the app running on the host with `next dev` for fast refresh, and point it at the Compose Postgres via `DATABASE_URL`.

```yaml
# compose.yaml
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

Rules:

- Prefer `compose.yaml` (the current Compose Specification filename) over the legacy `docker-compose.yml`; either works with a current Docker Compose v2 (`docker compose ...`, no hyphen) install, but don't introduce the old `version:` top-level key — it's obsolete and Compose warns on it.
- **Named volumes for stateful services** (`postgres_data` above), never anonymous volumes, so `docker compose down` doesn't silently orphan data — and never `docker compose down -v` without confirming that's actually intended, it deletes the volume.
- Give every service with dependents a `healthcheck` and gate startup order with `depends_on: { condition: service_healthy }`, not a bare `depends_on:` (which only waits for the container to start, not for Postgres to accept connections) or a manual `sleep`.
- Keep real secrets out of `compose.yaml` — use a git-ignored `.env` file (Compose auto-loads one from the project root) referenced via `${VAR}` interpolation, and commit an `.env.example` with placeholder values instead.
- If this project's Drizzle schema needs to be pushed to the local Compose Postgres, run `drizzle-kit push` from the host against `localhost:5432` (the mapped port) — don't run migration tooling inside the Postgres container.
- Only add the Next.js app itself as a Compose service if the actual goal is testing the *production container* end-to-end (e.g. verifying the Dockerfile above) or fully-containerized parity for CI — otherwise it's extra rebuild latency for no benefit over `next dev`.

**This repo already has this stack.** `compose.yaml` at the root defines the local Postgres (host port **5433**, bound to `127.0.0.1`, `${POSTGRES_PORT}` override) and `Tiltfile` orchestrates it: `tilt up` starts Postgres, runs `npm run db:migrate` once it's healthy, then `next dev`, with manual `db-seed` / `create-admin` resources. Extend those files (rather than writing another dev-Postgres Compose setup) and keep `DATABASE_URL` in `.env` in sync with the mapped port. See `README.md` for the workflow.

**There is also a self-host/tryout image**, a separate concern from the dev stack above: `Dockerfile` builds the app (and, unlike the minimal-image pattern earlier in this doc, deliberately keeps the full `node_modules` + source so the same image can also run `npm run db:migrate` / `npm run seed` — simplicity over size, since the target audience is newcomers trying the app, not a size-optimized prod deploy). `.github/workflows/docker-publish.yml` builds and pushes it to `ghcr.io/<owner>/open-crosswords` on pushes to `main` and version tags. `compose.tryout.yaml` pulls that prebuilt image plus a throwaway Postgres (`postgres` → one-shot `migrate`/`seed` → `app`) so someone can try the whole app with `docker compose -f compose.tryout.yaml up -d` and no clone/build/Node install. Extend these three together if the self-host path changes; they don't replace `compose.yaml`/`Tiltfile`, which stay dev-only.

## Security checklist (applies to both)

- No secrets in image layers, `ARG`s, or committed Compose files — env vars injected at run time only.
- Non-root `USER` in every image that runs application code.
- Base images pinned to a specific tag (and ideally digest, `@sha256:...`, for production builds) — never `latest`.
- Prefer `-alpine` or distroless variants to shrink attack surface, unless native modules require glibc.
- `.dockerignore` excludes `.git`, `.env*`, and any credentials directory from the build context.
- Don't expose the Postgres port (`5432`) beyond `localhost` in any shared/deployed Compose file — bind it explicitly (`127.0.0.1:5432:5432`) if it must be published at all.
