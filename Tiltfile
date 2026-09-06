# -*- mode: Python -*-
# Local development orchestration for open-crosswords.
#
#   tilt up      start Postgres, apply migrations, create the dev admin login,
#                run `next dev` with live reload
#   tilt down    stop the app and the Postgres container (data volume is kept)
#
# Re-trigger a step from the Tilt UI (or `tilt trigger <name>`):
#   db-seed         load data/seed-en.json into the question library
#   create-admin    (re)provision the admin login
#
# Prerequisites: Docker, Node 20+, and `npm install` already run.
#
# Flags:
#   tilt up -- --seed                        also run db-seed on startup
#   tilt up -- --admin-email=me@example.com  use a different dev admin login
#   tilt up -- --admin-password='...'        (min 12 characters)

config.define_bool('seed')
config.define_string('admin-email')
config.define_string('admin-name')
config.define_string('admin-password')
cfg = config.parse()
seed_on_start = cfg.get('seed', False)

# Dev admin credentials. The default password is published (README, this file),
# so create-admin below refuses it unless DATABASE_URL names this machine — it
# must never end up in a hosted database. A URL is all that check has to go on,
# so a tunnel that forwards localhost to a hosted database still gets through. ADMIN_EMAIL / ADMIN_NAME /
# ADMIN_PASSWORD in .env (or the environment) win over these, and the flags
# above override the built-in defaults.
DEV_ADMIN_PASSWORD = 'local-dev-password'
admin_email = cfg.get('admin-email', 'admin@example.com')
admin_name = cfg.get('admin-name', 'Admin')
admin_password = cfg.get('admin-password', DEV_ADMIN_PASSWORD)

# The address is the one value spliced into shell text below, so it may not
# carry anything the shell would act on.
for ch in ['"', "'", '`', '$', '|', '&', ';', '\\', '<', '>', '(', ')', ' ', '\n', '#']:
    if ch in admin_email:
        fail('--admin-email may not contain %r' % ch)

# 1. Make sure a local .env exists (placeholder secrets + local DB URL), with
#    the dev admin address allow-listed so the login below can reach /admin.
#    .env.example itself keeps an obvious placeholder, so a deployment built
#    from it never ships an allow-listed address strangers can sign up as.
if not os.path.exists('.env'):
    local(
        'sed "s|^ADMIN_EMAILS=.*|ADMIN_EMAILS=\\"%s\\"|" .env.example > .env' % admin_email,
        quiet=True,
        echo_off=True,
    )
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

# 5. Provision the admin login from the values resolved above. It leaves an
#    existing account alone, so re-running it on every `tilt up` is a no-op.
local_resource(
    'create-admin',
    cmd=with_env(
        # The published default password is only ever allowed against a local
        # database; anywhere else, the developer must supply their own.
        # The literal is compared inline rather than through a second variable,
        # because .env is sourced last and would otherwise be able to redefine
        # what "the default password" means.
        'if [ "$ADMIN_PASSWORD" = "%s" ]; then case "$DATABASE_URL" in ' % DEV_ADMIN_PASSWORD +
        '*@localhost:*|*@localhost/*|*@127.0.0.1:*|*@127.0.0.1/*) ;; *) ' +
        'echo "DATABASE_URL is not local: refusing to create an admin with the published dev password."; ' +
        'echo "Point it at the compose Postgres, or pass tilt up -- --admin-password=<your own>."; ' +
        'exit 1;; esac; fi; ' +
        # The password is passed in the environment, not on the command line,
        # where every local user could read it out of `ps`.
        'npm run create-admin -- "$ADMIN_EMAIL" "$ADMIN_NAME"'
    ),
    env={
        'ADMIN_EMAIL': admin_email,
        'ADMIN_NAME': admin_name,
        'ADMIN_PASSWORD': admin_password,
    },
    resource_deps=['db-migrate'],
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['db'],
)

# 6. Next.js dev server.
# Bound to the loopback address: this stack runs with the committed placeholder
# BETTER_AUTH_SECRET and a known admin password, so it must not be reachable
# from the rest of the network.
local_resource(
    'web',
    serve_cmd='npm run dev -- -H 127.0.0.1',
    resource_deps=['db-migrate'],
    links=[link('http://localhost:3000', 'open-crosswords')],
    labels=['app'],
)
