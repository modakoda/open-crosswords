import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { publicProcedure } from "@/lib/orpc/middleware";
import { getCurrentUser } from "@/lib/auth-guard";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { listCategories, listLanguages } from "@/lib/entries";
import { generatePuzzle, getPuzzleBySlug, NotEnoughEntriesError } from "@/lib/puzzles";
import {
  LANGUAGE_CODE,
  generatePuzzleSchema,
  puzzleSlugSchema,
} from "@/lib/validation/schemas";

const languagesList = publicProcedure.input(z.void()).handler(async () => {
  return { languages: await listLanguages() };
});

const categoriesList = publicProcedure
  .input(z.object({ languageCode: LANGUAGE_CODE }))
  .handler(async ({ input }) => {
    return { categories: await listCategories(input.languageCode) };
  });

const puzzlesGenerate = publicProcedure
  .input(generatePuzzleSchema)
  .handler(async ({ input, context }) => {
    const limit = rateLimit(clientKey(context.headers, "generate"), 20, 60);
    if (!limit.ok) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many puzzles generated, slow down",
        data: { retryAfter: limit.retryAfter },
      });
    }

    // Attach the acting client if signed in; anonymous generation stays anonymous.
    const user = await getCurrentUser();

    try {
      const puzzle = await generatePuzzle(input, user?.id ?? null);
      return { puzzle };
    } catch (err) {
      if (err instanceof NotEnoughEntriesError) {
        throw new ORPCError("UNPROCESSABLE_CONTENT", { message: err.message });
      }
      console.error("generate puzzle error:", err);
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not generate puzzle" });
    }
  });

const puzzlesGetBySlug = publicProcedure
  .input(z.object({ slug: puzzleSlugSchema }))
  .handler(async ({ input }) => {
    const puzzle = await getPuzzleBySlug(input.slug);
    if (!puzzle) throw new ORPCError("NOT_FOUND", { message: "Puzzle not found" });
    return { puzzle };
  });

export const publicRouter = {
  languages: { list: languagesList },
  categories: { list: categoriesList },
  puzzles: { generate: puzzlesGenerate, getBySlug: puzzlesGetBySlug },
};
