#!/bin/sh
# Container entrypoint: bring the database up to date, then hand over to the
# container's command (`npm start` by default — see the Dockerfile).
#
# Migrations run here rather than in a separate deploy step so that any host
# able to run this image — Coolify, compose, a plain `docker run` — gets a
# schema matching the code it just pulled, without extra configuration. The
# migrations are the committed SQL under drizzle/, applied by drizzle-kit,
# which records what it has already run: re-launching a container is a no-op.
#
# Two limits worth knowing:
#   * Starting several replicas at once means several concurrent migrators,
#     and drizzle-kit takes no lock — one of them fails on the half-applied
#     work of another. Roll out one instance first, or set SKIP_DB_MIGRATE=1
#     on the replicas and migrate as its own step.
#   * A migration that fails stops the container instead of serving requests
#     against a schema the code does not expect. That is deliberate.
set -e

if [ "${SKIP_DB_MIGRATE:-}" = "1" ]; then
  echo "entrypoint: SKIP_DB_MIGRATE=1 — skipping database migrations"
else
  # The database is often still accepting no connections when the app
  # container starts, so a failure gets a few retries before it counts. A
  # genuinely broken migration just fails these attempts in turn and exits.
  attempt=1
  max_attempts="${DB_MIGRATE_ATTEMPTS:-5}"
  retry_delay="${DB_MIGRATE_RETRY_SECONDS:-3}"
  until npm run db:migrate; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "entrypoint: migrations failed after ${attempt} attempt(s)" >&2
      exit 1
    fi
    echo "entrypoint: migration attempt ${attempt} failed, retrying in ${retry_delay}s" >&2
    attempt=$((attempt + 1))
    sleep "$retry_delay"
  done
fi

exec "$@"
