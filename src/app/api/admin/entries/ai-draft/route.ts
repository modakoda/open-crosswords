import { adminRoute, apiError, json, parse, readJson } from "@/lib/api";
import { aiDraftSchema } from "@/lib/validation/schemas";
import { draftEntries, AiDisabledError } from "@/lib/ai/draft";
import { isAiEnabled } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = adminRoute(async (req: Request) => {
  if (!isAiEnabled()) return apiError(501, "AI drafting is not configured");

  const limit = rateLimit(clientKey(req.headers, "ai-draft"), 10, 60);
  if (!limit.ok) return apiError(429, "Slow down", { retryAfter: limit.retryAfter });

  const read = await readJson(req);
  if (!read.ok) return read.response;
  const parsed = parse(aiDraftSchema, read.body);
  if (!parsed.ok) return parsed.response;

  try {
    const drafts = await draftEntries(parsed.data);
    return json({ drafts });
  } catch (err) {
    if (err instanceof AiDisabledError) return apiError(501, err.message);
    console.error("ai-draft error:", err);
    return apiError(502, "AI provider request failed");
  }
});
