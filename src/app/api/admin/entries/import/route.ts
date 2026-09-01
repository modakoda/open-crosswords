import { adminRoute, apiError, json, parse, readJson } from "@/lib/api";
import { importSchema } from "@/lib/validation/schemas";
import { importEntries, parseImportText } from "@/lib/import";
import { ensureLanguage } from "@/lib/entries";

export const runtime = "nodejs";

export const POST = adminRoute(async (req: Request) => {
  // importSchema.text is capped at 500 KB; allow headroom for JSON envelope.
  const read = await readJson(req, 768 * 1024);
  if (!read.ok) return read.response;
  const parsed = parse(importSchema, read.body);
  if (!parsed.ok) return parsed.response;

  let rows;
  try {
    rows = parseImportText(parsed.data.text, parsed.data.format);
  } catch (err) {
    return apiError(422, `Could not parse ${parsed.data.format}: ${String(err instanceof Error ? err.message : err)}`);
  }
  if (rows.length > 2000) return apiError(422, "Import capped at 2000 rows per request");

  await ensureLanguage(parsed.data.languageCode);
  const result = await importEntries(
    parsed.data.languageCode,
    rows,
    parsed.data.createMissingCategories,
  );
  return json(result);
});
