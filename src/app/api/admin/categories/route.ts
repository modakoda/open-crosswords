import { adminRoute, json, parse, readJson } from "@/lib/api";
import { createCategorySchema } from "@/lib/validation/schemas";
import { ensureCategory } from "@/lib/entries";

export const runtime = "nodejs";

export const POST = adminRoute(async (req: Request) => {
  const read = await readJson(req);
  if (!read.ok) return read.response;
  const parsed = parse(createCategorySchema, read.body);
  if (!parsed.ok) return parsed.response;
  const category = await ensureCategory(parsed.data.languageCode, parsed.data.name);
  return json({ category }, { status: 201 });
});
