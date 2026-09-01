import {
  createEntry,
  listEntries,
  DuplicateEntryError,
  InvalidAnswerError,
} from "@/lib/entries";
import { adminRoute, apiError, json, parse, readJson } from "@/lib/api";
import {
  createEntrySchema,
  listEntriesQuerySchema,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

export const GET = adminRoute(async (req: Request) => {
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = parse(listEntriesQuerySchema, q);
  if (!parsed.ok) return parsed.response;
  return json(await listEntries(parsed.data));
});

export const POST = adminRoute(async (req: Request) => {
  const read = await readJson(req);
  if (!read.ok) return read.response;
  const parsed = parse(createEntrySchema, read.body);
  if (!parsed.ok) return parsed.response;
  try {
    const entry = await createEntry(parsed.data);
    return json({ entry }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateEntryError) return apiError(409, err.message);
    if (err instanceof InvalidAnswerError) return apiError(422, err.message);
    throw err;
  }
});
