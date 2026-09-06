import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { exceedsBodyLimit } from "@/lib/body-limit";

export const runtime = "nodejs";

// An auth body is a handful of short fields, so anything larger is not a real
// sign-in. Each field's own limits (better-auth's schemas, and the length bound
// in `attemptedEmail`) remain the hard limit either way.
const MAX_BODY_BYTES = 16 * 1024;

const { GET, POST: handleAuthPost } = toNextJsHandler(auth);

export { GET };

export async function POST(request: Request) {
  if (exceedsBodyLimit(request, MAX_BODY_BYTES)) {
    return new Response("Request body too large", { status: 413 });
  }
  return handleAuthPost(request);
}
