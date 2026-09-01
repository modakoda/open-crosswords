import { listCategories } from "@/lib/entries";
import { apiError, json } from "@/lib/api";
import { LANGUAGE_CODE } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("languageCode");
  const parsed = LANGUAGE_CODE.safeParse(raw);
  if (!parsed.success) return apiError(400, "languageCode query param required");
  return json({ categories: await listCategories(parsed.data) });
}
