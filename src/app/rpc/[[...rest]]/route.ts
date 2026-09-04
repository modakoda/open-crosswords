import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { router } from "@/lib/orpc/router";
import type { RpcContext } from "@/lib/orpc/context";

export const runtime = "nodejs";
export const maxDuration = 60; // covers the ai-draft procedure's LLM call

// Generous cap covering the largest legitimate payload (bulk import text,
// ~500KB per its Zod schema) with headroom for the request envelope. This is
// a soft, defense-in-depth check on `Content-Length` — a chunked request
// carries none and slips past it, so `importSchema.text`'s own `.max()`
// remains the hard limit either way (same trade-off the old `readJson`
// helper documented). Not using oRPC's built-in `BodyLimitPlugin` here: as
// of @orpc/server 1.15.0 it breaks under Next.js 16's Turbopack production
// build with "Cannot read private member #state from an object whose class
// did not declare it" — a bundler/library incompatibility, not a config
// mistake; revisit switching back once that's fixed upstream.
const MAX_BODY_BYTES = 1024 * 1024;

const handler = new RPCHandler(router, {
  interceptors: [onError((error) => console.error(error))],
});

async function handleRequest(request: Request) {
  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) {
    return new Response("Request body too large", { status: 413 });
  }

  const context: RpcContext = { headers: request.headers };
  const { response } = await handler.handle(request, { prefix: "/rpc", context });
  return response ?? new Response("Not found", { status: 404 });
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
