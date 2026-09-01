---
name: bun
description: >-
  Guides and best practices for using Bun — the fast all-in-one JavaScript/TypeScript
  runtime, package manager, bundler, and test runner. Covers installation, package
  management (install/add/remove, bun.lock), running and building TypeScript/JS
  directly, the built-in test runner, env var loading, and Node.js/npm compatibility
  notes. Use when the user mentions "bun", "bunx", "bun install", "bun run",
  "bun.lockb"/"bun.lock", "bun test", "bun build", or wants to switch a project's
  package manager or runtime to Bun.
metadata:
  source: https://bun.sh/docs
---

# Bun

Bun is a single binary that replaces Node.js, npm/yarn/pnpm, and common tooling (dotenv, ts-node, jest/vitest, webpack/esbuild for simple cases) with one fast tool written in Zig.

**Verify against current docs before relying on niche APIs** — Bun ships frequently:

- Docs: https://bun.sh/docs
- Check installed/latest version: `bun --version` vs `npm view bun version` (or the [releases page](https://github.com/oven-sh/bun/releases)).

## Install Bun itself

```bash
curl -fsSL https://bun.sh/install | bash   # macOS/Linux
# or: brew install bun / npm install -g bun
```

Upgrade in place: `bun upgrade`.

## Package Management

Drop-in replacement for npm/yarn/pnpm — same `package.json`, much faster installs.

```bash
bun install            # install deps from package.json (reads existing npm/yarn/pnpm lockfile once, then writes bun.lock)
bun add <pkg>           # add a dependency
bun add -d <pkg>        # add a dev dependency
bun add -g <pkg>        # install globally
bun remove <pkg>
bun update [pkg]        # upgrade deps (respecting semver ranges) or one package
```

- Lockfile is `bun.lock` (text, human-readable/diffable) as of Bun 1.2+; older projects may have the binary `bun.lockb` — `bun install` migrates it automatically. Commit whichever one is present.
- `bun install --frozen-lockfile` for CI — fails instead of updating the lockfile, same intent as `npm ci`.
- Workspaces use the same `"workspaces"` field in `package.json` as npm/yarn — no config changes needed to adopt Bun in a monorepo.

## Running Code

Bun executes TypeScript, JSX, and TSX **directly** — no build step, no `ts-node`, no separate transpile config:

```bash
bun run index.ts        # or just: bun index.ts
bun run <script-name>   # runs a package.json "scripts" entry (like npm run)
bun run dev              # e.g. this repo's Next.js dev script, if package.json defines one
```

- `bun run` for an npm script; bare `bun <file>` for executing a file directly — both work, `bun run` also works for files.
- `--watch` restarts on file change: `bun --watch run index.ts` / `bun --watch index.ts`.
- `--hot` does in-process hot reload (state-preserving) instead of a full restart, for long-running servers.

### bunx

Equivalent to `npx` — runs a package's binary without a permanent install, using a local cache:

```bash
bunx <package> [args]
```

## Env Vars

Bun auto-loads `.env`, `.env.local`, `.env.<NODE_ENV>` and expands `${VAR}` references — no `dotenv` package needed. Access via `process.env` or `Bun.env` (both work; `Bun.env` is a plain object, slightly faster to read repeatedly).

## Built-in Test Runner

Jest-compatible API, no separate framework/config needed:

```bash
bun test                       # runs *.test.ts / *.spec.ts (and .js/.tsx) files
bun test --watch
bun test path/to/file.test.ts
bun test -t "pattern"          # filter by test name
```

```ts
import { test, expect, describe, mock } from "bun:test";
```

If a project already uses Vitest/Jest with plugins those tools provide (custom matchers, specific reporters), migrating wholesale isn't automatic — check what's actually used before swapping the test runner.

## Bundler / Build

```bash
bun build ./index.ts --outdir ./dist
bun build ./index.ts --outdir ./dist --target=browser   # or: bun, node
bun build ./index.ts --compile --outfile myapp           # single-file standalone executable
```

Use `--minify`, `--sourcemap`, `--splitting` as needed. For app frameworks (Next.js, etc.) prefer the framework's own build command — Bun here is typically just the **runtime/package manager**, not the bundler, unless explicitly building a standalone script/CLI.

## Node.js / npm Compatibility

- Implements most of the Node.js API (`fs`, `path`, `http`, `crypto`, streams, etc.) and `node_modules` resolution, so most existing npm packages and Node scripts run unmodified.
- Native Node addons (`.node` files / N-API) have partial, improving support — check for known issues if a dependency relies on native bindings.
- Bun-specific APIs (`Bun.serve`, `Bun.file`, `Bun.$` shell, `Bun.password`, `bun:sqlite`) are faster/more ergonomic replacements for common Node patterns but are **not portable** to plain Node — only reach for them when the code is Bun-only by design (e.g. scripts, tooling), not in library code meant to run under Node too.
- `Bun.$\`cmd\`` is a built-in cross-platform shell (no `execa`/`shelljs` needed) for scripting: `` await $`ls -la`.text() ``.

## Using Bun in This Repo

If adopting Bun as the package manager/runtime here (Next.js + Drizzle + Neon + better-auth stack):

- `bun install` reads the existing lockfile once; after that, delete the old npm/yarn/pnpm lockfile to avoid confusion about which is authoritative — but only after confirming with the user, since this affects CI and everyone else's local setup.
- `next dev`/`next build` run fine under `bun run dev` / `bun run build` (Next.js scripts execute as normal Node-compatible JS); Bun here is a faster installer/runner, not a Next.js bundler replacement.
- `drizzle-kit` CLI commands work the same via `bunx drizzle-kit ...` or a `package.json` script.

## Gotchas

- **Lockfile format changed** (`bun.lockb` binary → `bun.lock` text) in Bun 1.2 — don't assume a repo's lockfile is binary; check which one is actually present before scripting around it.
- **`bun install` migrates other lockfiles once** — running it in a repo that still has `package-lock.json`/`yarn.lock` doesn't error, but leaves stale files around; clean up deliberately, don't just delete other lockfiles without checking nothing still depends on that package manager (CI config, Docker images).
- **Native/N-API addons**: if `bun install` or runtime fails only for one dependency with native bindings, that's a compatibility gap, not necessarily a config mistake — check the package's Bun support status before debugging further.
- **`Bun.serve`/`bun:sqlite`/etc. lock code to the Bun runtime** — fine for standalone scripts, but don't introduce them into shared library code that also needs to run under Node.
