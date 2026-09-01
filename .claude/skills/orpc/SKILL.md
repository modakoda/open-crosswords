---
name: orpc
description: >-
  Guides and best practices for oRPC, the end-to-end typesafe RPC framework
  for TypeScript. Covers installation, defining procedures/routers with the
  `os` builder and Zod input/output schemas, the Next.js App Router adapter
  (RPCHandler, route file convention), Server Actions support, the client
  (RPCLink + createORPCClient), contract-first APIs, and native OpenAPI
  generation. Use when the user mentions "orpc", "@orpc/server",
  "@orpc/client", "RPCHandler", "RPCLink", procedure/router definitions, or
  wants typesafe client-server calls instead of hand-rolled fetch wrappers
  or tRPC.
metadata:
  source: https://orpc.dev/docs
---

# oRPC

oRPC gives end-to-end typesafe RPC in TypeScript: define plain functions ("procedures") on the server, call them like local async functions from the client — no code generation, types flow via inference. It composes with [Zod](../zod/SKILL.md) (or any Standard Schema library) for input/output validation, and can also generate an OpenAPI spec from the same procedures for REST-style consumption.

**Verify against current docs before writing code** — this is a fast-moving pre-1.x-adjacent ecosystem with a `beta` (2.0) tag ahead of `latest`:

- Docs: https://orpc.dev/docs
- Check the actual installed/latest **stable** version before assuming an API: `npm view @orpc/server version` (this returns the `latest` dist-tag; don't follow `beta`/`next` tag docs unless the repo has explicitly opted into the 2.0 beta).

## Install

```bash
npm install @orpc/server @orpc/client zod
```

`@orpc/server` is the backend builder/handler, `@orpc/client` is the typed client, `zod` provides the schemas.

## Defining procedures and a router

```ts
import { os } from "@orpc/server";
import * as z from "zod";

const getPlanet = os
  .input(z.object({ id: z.number() }))
  .handler(async ({ input }) => ({ id: input.id, name: "Earth" }));

export const router = {
  planet: { get: getPlanet },
};
```

A **router** is just a plain nested object of procedures — call paths (`planet.get`) come from the object shape, not decorators or file-based routing. Chain `.input(schema)` / `.output(schema)` before `.handler(fn)`; the handler's inferred return type becomes the client's return type when `.output()` is omitted.

## Next.js App Router integration

File: `app/rpc/[[...rest]]/route.ts` — a single catch-all route mounts the whole router:

```ts
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { router } from "@/lib/orpc/router";

const handler = new RPCHandler(router, {
  interceptors: [onError((error) => console.error(error))],
});

async function handleRequest(request: Request) {
  const { response } = await handler.handle(request, { prefix: "/rpc", context: {} });
  return response ?? new Response("Not found", { status: 404 });
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
```

This coexists with plain REST-style route handlers elsewhere under `src/app/api/**` (see [backend-developer.md](../agents/backend-developer.md)) — reach for oRPC when you want a typed procedure callable directly from client code without hand-writing a fetch wrapper and matching response types, not as a forced replacement for every existing route.

Server Actions are supported without extra config — oRPC procedures can be invoked directly as server functions; see https://orpc.dev/docs/adapters/next for the current details before wiring this up, since the Next.js body parser has known caveats (bracket notation, `application/json` files) covered there.

## Client

```ts
import type { RouterClient } from "@orpc/server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { router } from "@/lib/orpc/router";

const link = new RPCLink({ url: "/rpc" });
export const orpc: RouterClient<typeof router> = createORPCClient(link);

// Usage:
await orpc.planet.get({ id: 1 });
```

The client type is derived from `typeof router` (server-side type only, no runtime import needed) — this is what gives full autocomplete/type-checking on the caller side.

## Auth / context

Pass request-derived context (e.g. the better-auth session) through `handler.handle(request, { context })`, then read it in a procedure via `os.$context<AppContext>()` or a `.use()` middleware that populates `context.session`. Don't re-derive auth by hand inside each handler — follow this repo's existing convention of deriving the acting user from `auth.api.getSession()` (see [better-auth skill](../better-auth/SKILL.md)) inside shared middleware once, not per-procedure.

## vs. tRPC

oRPC intentionally targets tRPC users: similar procedure/router mental model, but adds native OpenAPI generation (same procedures served as REST + RPC), contract-first support (define the API shape before the implementation, enforced by TypeScript), first-class binary/File handling, and native `Date`/`URL`/`Set`/`Map` serialization without a transformer. See https://orpc.dev/docs/migrations/from-trpc if porting existing tRPC routers.

## Gotchas

- Don't follow `beta`-tagged (2.0) docs/examples against a `latest` (1.x) install — check `npm view @orpc/server dist-tags` before trusting an API shown in search results, since 2.0-beta docs and 1.x docs both live on orpc.dev.
- The router object's shape *is* the API surface — renaming a key changes the client call path; there's no separate route-string to keep in sync.
- `.output()` is optional but recommended for handlers with non-trivial return shapes — without it, the client type is whatever TypeScript infers from the handler body, which can silently widen if the handler changes.
