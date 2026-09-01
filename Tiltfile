# -*- mode: Python -*-
# Local development orchestration for open-crosswords.
#
#   tilt up      start Postgres, apply migrations, run `next dev` with live reload
#   tilt down    stop the app and the Postgres container (data volume is kept)
#
# Trigger the manual steps from the Tilt UI (or `tilt trigger <name>`):
#   db-seed         load data/seed-en.json into the question library
#   create-admin    provision an admin login (needs ADMIN_EMAIL / ADMIN_PASSWORD)
#
# Prerequisites: Docker, Node 20+, and `npm install` already run.
#
# Flags:
#   tilt up -- --seed        also run db-seed automatically on startup

config.define_bool('seed')
cfg = config.parse()
seed_on_start = cfg.get('seed', False)

# 1. Make sure a local .env exists (placeholder secrets + local DB URL).
if not os.path.exists('.env'):
    local('cp .env.example .env', quiet=True, echo_off=True)
    print('Tilt: created .env from .env.example — adjust it if you need non-default settings.')

# Run a command with the vars from .env exported, so drizzle-kit and the
# tsx scripts all see the same DATABASE_URL / secrets that `next` does.
def with_env(cmd):
    return 'set -a && . ./.env && set +a && ' + cmd

# 2. Postgres via docker-compose.
docker_compose('./compose.yaml')
dc_resource('postgres', labels=['infra'])

# 3. Apply Drizzle migrations once Postgres reports healthy.
local_resource(
    'db-migrate',
    cmd=with_env('npm run db:migrate'),
    resource_deps=['postgres'],
    deps=['drizzle', 'drizzle.config.ts', 'src/db/schema'],
    labels=['db'],
)

# 4. Seed the question library (manual; auto on `tilt up -- --seed`).
local_resource(
    'db-seed',
    cmd=with_env('npm run seed'),
    resource_deps=['db-migrate'],
    trigger_mode=TRIGGER_MODE_MANUAL,
    auto_init=seed_on_start,
    labels=['db'],
)

# 5. Provision an admin login (manual). The script is interactive by default,
#    so here we feed it from env vars:
#      ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='a-long-password' tilt trigger create-admin
#    Remember to also add the email to ADMIN_EMAILS in .env.
local_resource(
    'create-admin',
    cmd=with_env(
        'if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then ' +
        'echo "Set ADMIN_EMAIL and ADMIN_PASSWORD (>=12 chars), then trigger again."; exit 1; fi; ' +
        'npm run create-admin -- "$ADMIN_EMAIL" "${ADMIN_NAME:-Admin}" "$ADMIN_PASSWORD"'
    ),
    resource_deps=['db-migrate'],
    trigger_mode=TRIGGER_MODE_MANUAL,
    auto_init=False,
    labels=['db'],
)

# 6. Next.js dev server.
local_resource(
    'web',
    serve_cmd='npm run dev',
    resource_deps=['db-migrate'],
    links=[link('http://localhost:3000', 'open-crosswords')],
    labels=['app'],
)
