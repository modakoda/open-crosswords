/**
 * Soft, defense-in-depth cap on a request body, read from `Content-Length`.
 *
 * A chunked request carries no such header and slips past this, so it never
 * stands in for a schema's own `.max()` — that stays the hard limit. What it
 * buys is refusing an obviously oversized body before anything buffers or
 * parses it.
 */
export function exceedsBodyLimit(request: Request, maxBytes: number): boolean {
  return Number(request.headers.get("content-length") ?? "0") > maxBytes;
}
