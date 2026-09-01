import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { ForbiddenError, requireAdmin } from "@/lib/auth-guard";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiError(status: number, message: string, extra?: unknown) {
  return NextResponse.json(
    { error: message, ...(extra ? { details: extra } : {}) },
    { status },
  );
}

/**
 * Read and JSON-parse a request body, rejecting anything over `maxBytes` up
 * front via `Content-Length`. Returns the parsed value or a ready-to-return
 * error response.
 *
 * This is a soft, defense-in-depth cap: a chunked request carries no
 * `Content-Length` and slips past it, so the hosting platform's own body
 * limit (Vercel: ~4.5 MB) is the real ceiling. Zod length limits downstream
 * (e.g. `importSchema.text`) still bound what actually gets processed.
 */
export async function readJson(
  req: Request,
  maxBytes = 64 * 1024,
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) {
    return { ok: false, response: apiError(413, "Request body too large") };
  }
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, response: apiError(400, "Invalid JSON body") };
  }
}

/** Parse an unknown value with Zod, returning a typed result or a 400 response. */
export function parse<S extends z.ZodType>(
  schema: S,
  value: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    response: apiError(400, "Invalid request", result.error.flatten()),
  };
}

/** Wrap a handler: enforce admin, and turn known errors into clean responses. */
export function adminRoute<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      await requireAdmin();
      return await handler(...args);
    } catch (err) {
      if (err instanceof ForbiddenError) return apiError(403, "Forbidden");
      if (err instanceof ZodError) return apiError(400, "Invalid request", err.flatten());
      console.error("admin route error:", err);
      return apiError(500, "Internal error");
    }
  };
}
