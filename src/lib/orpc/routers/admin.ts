import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { adminProcedure } from "@/lib/orpc/middleware";
import { adminPuzzlesRouter } from "./admin-puzzles";
import { adminUsersRouter } from "./admin-users";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import {
  createEntry,
  deleteEntries,
  deleteEntry,
  listEntries,
  updateEntry,
  CategoryLanguageError,
  DuplicateEntryError,
  InvalidAnswerError,
  UnknownLanguageError,
} from "@/lib/entries";
import {
  deleteLanguage,
  ensureCategory,
  ensureLanguage,
  languageExists,
  listLanguages,
  listLanguagesWithCounts,
  renameLanguage,
} from "@/lib/taxonomy";
import { importEntries, parseImportText, ImportTooLargeError } from "@/lib/import";
import { draftEntries, AiDisabledError } from "@/lib/ai/draft";
import { isAiEnabled } from "@/lib/env/server";
import {
  createCategorySchema,
  createEntrySchema,
  createLanguageSchema,
  deleteEntriesSchema,
  deleteLanguageSchema,
  renameLanguageSchema,
  importSchema,
  listEntriesQuerySchema,
  updateEntrySchema,
  aiDraftSchema,
} from "@/lib/validation/schemas";

const languagesCreate = adminProcedure
  .input(createLanguageSchema)
  .handler(async ({ input }) => {
    await ensureLanguage(input.code, input.name);
    return { languages: await listLanguages() };
  });

/**
 * The languages screen's own listing. Kept apart from the public
 * `languages.list` every view fills its picker from: this one carries the
 * counts that only an admin has any business seeing.
 */
const languagesList = adminProcedure
  .input(z.void())
  .handler(async () => ({ languages: await listLanguagesWithCounts() }));

const languagesRename = adminProcedure
  .input(renameLanguageSchema)
  .handler(async ({ input }) => {
    const language = await renameLanguage(input.code, input.name);
    if (!language) {
      throw new ORPCError("NOT_FOUND", { message: "Language not found" });
    }
    return { languages: await listLanguagesWithCounts() };
  });

/**
 * Removing a language, which is only allowed while nothing is filed under it.
 * The two failures are told apart deliberately: a language that is still there
 * after the guarded delete is one the library depends on, and saying so is the
 * whole point — an admin clearing up a typo needs to know the difference
 * between "already gone" and "in use".
 */
const languagesDelete = adminProcedure
  .input(deleteLanguageSchema)
  .handler(async ({ input }) => {
    const removed = await deleteLanguage(input.code);
    if (!removed) {
      if (await languageExists(input.code)) {
        throw new ORPCError("CONFLICT", {
          message: "Language still has entries or puzzles filed under it",
        });
      }
      throw new ORPCError("NOT_FOUND", { message: "Language not found" });
    }
    return { languages: await listLanguagesWithCounts() };
  });

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
      if (err instanceof DuplicateEntryError) {
        throw new ORPCError("CONFLICT", { message: err.message });
      }
      if (
        err instanceof InvalidAnswerError ||
        err instanceof CategoryLanguageError ||
        err instanceof UnknownLanguageError
      ) {
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

/**
 * Bulk delete. Unlike the single delete this doesn't 404 on ids that no longer
 * exist — a selection can go stale between listing and confirming, and the
 * admin's intent ("remove these") is still satisfied. The count says what
 * actually went.
 */
const entriesDeleteMany = adminProcedure
  .input(deleteEntriesSchema)
  .handler(async ({ input }) => {
    const rows = await deleteEntries(input.ids);
    return { deleted: rows.length };
  });

const MAX_IMPORT_ROWS = 2000;

const entriesImport = adminProcedure.input(importSchema).handler(async ({ input }) => {
  let rows;
  try {
    rows = parseImportText(input.text, input.format, MAX_IMPORT_ROWS);
  } catch (err) {
    if (err instanceof ImportTooLargeError) {
      throw new ORPCError("UNPROCESSABLE_CONTENT", { message: err.message });
    }
    throw new ORPCError("UNPROCESSABLE_CONTENT", {
      message: `Could not parse ${input.format}: ${err instanceof Error ? err.message : String(err)}`,
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
  languages: {
    list: languagesList,
    create: languagesCreate,
    rename: languagesRename,
    delete: languagesDelete,
  },
  puzzles: adminPuzzlesRouter,
  users: adminUsersRouter,
  categories: { create: categoriesCreate },
  entries: {
    list: entriesList,
    create: entriesCreate,
    update: entriesUpdate,
    delete: entriesDelete,
    deleteMany: entriesDeleteMany,
    import: entriesImport,
    aiDraft: entriesAiDraft,
  },
};
