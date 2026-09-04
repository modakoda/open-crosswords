import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { adminProcedure } from "@/lib/orpc/middleware";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import {
  createEntry,
  deleteEntry,
  ensureCategory,
  ensureLanguage,
  listEntries,
  updateEntry,
  DuplicateEntryError,
  InvalidAnswerError,
} from "@/lib/entries";
import { importEntries, parseImportText } from "@/lib/import";
import { draftEntries, AiDisabledError } from "@/lib/ai/draft";
import { isAiEnabled } from "@/lib/env";
import {
  createCategorySchema,
  createEntrySchema,
  importSchema,
  listEntriesQuerySchema,
  updateEntrySchema,
  aiDraftSchema,
} from "@/lib/validation/schemas";

const categoriesCreate = adminProcedure
  .input(createCategorySchema)
  .handler(async ({ input }) => {
    const category = await ensureCategory(input.languageCode, input.name);
    return { category };
  });

const entriesList = adminProcedure
  .input(listEntriesQuerySchema)
  .handler(async ({ input }) => listEntries(input));

const entriesCreate = adminProcedure
  .input(createEntrySchema)
  .handler(async ({ input }) => {
    try {
      return { entry: await createEntry(input) };
    } catch (err) {
      if (err instanceof DuplicateEntryError) {
        throw new ORPCError("CONFLICT", { message: err.message });
      }
      if (err instanceof InvalidAnswerError) {
        throw new ORPCError("UNPROCESSABLE_CONTENT", { message: err.message });
      }
      throw err;
    }
  });

const entriesUpdate = adminProcedure
  .input(z.object({ id: z.uuid(), patch: updateEntrySchema }))
  .handler(async ({ input }) => {
    try {
      const entry = await updateEntry(input.id, input.patch);
      if (!entry) throw new ORPCError("NOT_FOUND", { message: "Entry not found" });
      return { entry };
    } catch (err) {
      if (err instanceof InvalidAnswerError) {
        throw new ORPCError("UNPROCESSABLE_CONTENT", { message: err.message });
      }
      throw err;
    }
  });

const entriesDelete = adminProcedure
  .input(z.object({ id: z.uuid() }))
  .handler(async ({ input }) => {
    const deleted = await deleteEntry(input.id);
    if (!deleted) throw new ORPCError("NOT_FOUND", { message: "Entry not found" });
    return { deleted: true };
  });

const entriesImport = adminProcedure.input(importSchema).handler(async ({ input }) => {
  let rows;
  try {
    rows = parseImportText(input.text, input.format);
  } catch (err) {
    throw new ORPCError("UNPROCESSABLE_CONTENT", {
      message: `Could not parse ${input.format}: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  if (rows.length > 2000) {
    throw new ORPCError("UNPROCESSABLE_CONTENT", {
      message: "Import capped at 2000 rows per request",
    });
  }
  await ensureLanguage(input.languageCode);
  return importEntries(input.languageCode, rows, input.createMissingCategories);
});

const entriesAiDraft = adminProcedure
  .input(aiDraftSchema)
  .handler(async ({ input, context }) => {
    if (!isAiEnabled()) {
      throw new ORPCError("NOT_IMPLEMENTED", { message: "AI drafting is not configured" });
    }
    const limit = rateLimit(clientKey(context.headers, "ai-draft"), 10, 60);
    if (!limit.ok) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Slow down",
        data: { retryAfter: limit.retryAfter },
      });
    }
    try {
      return { drafts: await draftEntries(input) };
    } catch (err) {
      if (err instanceof AiDisabledError) {
        throw new ORPCError("NOT_IMPLEMENTED", { message: err.message });
      }
      console.error("ai-draft error:", err);
      throw new ORPCError("BAD_GATEWAY", { message: "AI provider request failed" });
    }
  });

export const adminRouter = {
  categories: { create: categoriesCreate },
  entries: {
    list: entriesList,
    create: entriesCreate,
    update: entriesUpdate,
    delete: entriesDelete,
    import: entriesImport,
    aiDraft: entriesAiDraft,
  },
};
