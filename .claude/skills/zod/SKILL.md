---
name: zod
description: >-
  Guides and best practices for Zod, the TypeScript-first schema validation
  library used for request/input validation in this project. Covers the
  Zod 4 API (top-level string formats, unified `error` param, object/record
  changes, `z.function()` redesign), migration from Zod 3 patterns, Zod Mini
  for bundle-sensitive code, and how schemas plug into API route/oRPC
  boundary validation. Use when the user mentions "zod", "z.object",
  "schema validation", "z.infer", parsing/validating request bodies or env
  vars, or writing/reviewing any `z.*` schema in this repo.
metadata:
  source: https://zod.dev
---

# Zod

Zod is a TypeScript-first schema validation library: define a schema once, get both runtime validation and a static type via `z.infer<typeof schema>`. In this repo it's the boundary-validation layer for API route bodies/params (see [backend-developer.md](../agents/backend-developer.md)) and for input/output schemas passed to `os.input()`/`os.output()` in [oRPC](../orpc/SKILL.md) procedures.

**This is Zod 4 — don't write Zod 3 patterns.** Zod ships fast and the v3→v4 API changed in several places that look valid but are deprecated or removed:

- Docs: https://zod.dev (llms.txt at https://zod.dev/llms.txt for a clean crawl)
- Changelog / migration: https://zod.dev/v4/changelog
- Check the actual installed version before assuming an API: `npm view zod version`, and diff against this repo's `package.json`. Import from the bare `"zod"` package — v4 is the default export as of 4.x, no `zod/v4` subpath needed unless pinning against a mixed v3/v4 install.

## Core usage

```ts
import * as z from "zod";

const CreateUserInput = z.object({
  name: z.string().min(1),
  email: z.email(), // top-level format, NOT z.string().email()
  age: z.number().int().positive().optional(),
});

type CreateUserInput = z.infer<typeof CreateUserInput>;

const result = CreateUserInput.safeParse(body); // { success, data } | { success, error }
if (!result.success) {
  return Response.json({ error: result.error.flatten() }, { status: 400 });
}
```

Prefer `safeParse`/`safeParseAsync` at API/route boundaries over `parse` (which throws) — catching a thrown `ZodError` for control flow is noisier than checking `result.success`.

## Zod 4 API — what changed from v3

| v3 | v4 | Notes |
|---|---|---|
| `z.string().email()` | `z.email()` | Also `z.uuid()`, `z.url()`, `z.base64()`, `z.ipv4()`, `z.ipv6()`, `z.cidrv4()`, `z.cidrv6()`, `z.iso.date()`, `z.iso.time()`, `z.iso.datetime()` — string formats are top-level, not chained methods |
| `.min(5, { message: "..." })` | `.min(5, { error: "..." })` | `message`, `invalid_type_error`, `required_error` are deprecated in favor of a single unified `error` param (can be a string or a function of the issue) |
| `.strict()` / `.passthrough()` | `z.strictObject({...})` / `z.looseObject({...})` | Object-mode is now set at construction, not chained after |
| `.merge(other)` | `.extend(other.shape)` | `.merge()` is gone |
| `.deepPartial()` | *(removed)* | No direct replacement — compose manually |
| `z.record(valueSchema)` | `z.record(keySchema, valueSchema)` | Now requires both key and value schemas; use `z.partialRecord()` if keys should be optional |
| `z.function()` returning a schema | `z.function({ input: [...], output })` then `.implement(fn)` | No longer schema-like; input is an array of positional-arg schemas |
| `.safe()` on numbers | *(deprecated)* | `.int()` already restricts to safe-integer range |

`z.number()` now rejects `Infinity`/`-Infinity` by default (previously allowed).

## Error customization

Zod 4 unifies error messages under one `error` param, usable per-check, per-schema, or globally:

```ts
z.string().min(5, { error: "Too short." });
z.string({ error: (issue) => issue.input === undefined ? "Required" : "Invalid" });
```

For global overrides (e.g. localization), use `z.config({ customError: ... })` — see https://zod.dev/error-customization rather than reaching for the old `errorMap` param.

## Zod Mini

`zod/mini` is a tree-shakable, functional-API variant (~6.5x smaller core bundle) for bundle-sensitive client code — same validation semantics, different call style (`z.optional(z.string())` instead of `z.string().optional()`). Reach for it only if bundle size on a client-shipped schema is an actual, measured problem; default to the standard `zod` API otherwise, since it's what the rest of this repo uses.

## JSON Schema interop

`z.toJSONSchema(schema)` converts a Zod schema to a JSON Schema document (useful for OpenAPI generation, e.g. alongside oRPC's OpenAPI output). `z.fromJSONSchema()` goes the other direction.

## Gotchas

- Writing `z.string().email()`/`.uuid()`/`.url()` still works in v4 (kept for compat) but new code should use the top-level `z.email()` etc. — don't copy the old chained form from memory or older examples.
- `{ message: "..." }` on a check silently still works in most cases but is deprecated — use `{ error: "..." }` in new/edited code.
- `z.record()` with one argument is a type error in v4 — always pass a key schema (commonly `z.string()`) first.
- Don't hand-roll validation with manual `if` checks where a schema already exists for the shape — reuse/compose the existing schema (`.pick()`, `.omit()`, `.extend()`) instead of duplicating field rules.
