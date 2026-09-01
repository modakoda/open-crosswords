import { z } from "zod";
import { deleteEntry, updateEntry, InvalidAnswerError } from "@/lib/entries";
import { adminRoute, apiError, json, parse, readJson } from "@/lib/api";
import { updateEntrySchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

const idSchema = z.uuid();

export const PATCH = adminRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return apiError(400, "Bad id");
    const read = await readJson(req);
    if (!read.ok) return read.response;
    const parsed = parse(updateEntrySchema, read.body);
    if (!parsed.ok) return parsed.response;
    try {
      const entry = await updateEntry(id, parsed.data);
      if (!entry) return apiError(404, "Entry not found");
      return json({ entry });
    } catch (err) {
      if (err instanceof InvalidAnswerError) return apiError(422, err.message);
      throw err;
    }
  },
);

export const DELETE = adminRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return apiError(400, "Bad id");
    const deleted = await deleteEntry(id);
    if (!deleted) return apiError(404, "Entry not found");
    return json({ deleted: true });
  },
);
