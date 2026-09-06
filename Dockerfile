# syntax=docker/dockerfile:1
#
# Self-host / "tryout" image for open-crosswords. Serves the app (`npm start`),
# applies pending migrations on every launch (scripts/docker-entrypoint.sh) and
# can seed the library (`npm run seed`) from the same image — see
# compose.tryout.yaml. That means it ships the full
# node_modules (incl. drizzle-kit/tsx) and app source rather than a trimmed
# `next.config.ts` `output: "standalone"` bundle; simplicity for newcomers
# wins over shaving image size here.
#
# Built and published to GHCR by .github/workflows/docker-publish.yml.

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` collects route metadata by importing server modules, which
# import src/lib/env.ts's Zod validation — it needs *some* well-formed values
# at build time. These are placeholders only (this stage's env vars don't
# carry into the runner stage below); real secrets are supplied at container
# run time via compose/orchestrator env vars, never baked into the image.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/build_placeholder" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-a-real-secret" \
    AUTH_IP_HEADER=""
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app ./
# The entrypoint is the file committed in this repo; the bit is set here so a
# checkout that lost it (Windows, a zip export) still produces a working image.
RUN chmod +x /app/scripts/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/" || exit 1

# Migrations run before the command, whatever the command is, so every host
# that can start this image gets a schema matching the code inside it.
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["npm", "start"]
