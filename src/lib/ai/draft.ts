import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { env, isAiEnabled } from "@/lib/env";
import { normalizeAnswer, isPlaceableAnswer } from "@/lib/crossword/normalize";
import type { AiDraftInput } from "@/lib/validation/schemas";

export class AiDisabledError extends Error {}

const draftSchema = z.object({
  entries: z
    .array(
      z.object({
        clue: z.string().min(3).max(300),
        answer: z.string().min(2).max(48),
        difficulty: z.number().int().min(1).max(5),
      }),
    )
    .min(1),
});

export interface DraftedEntry {
  clue: string;
  answer: string;
  difficulty: number;
}

/**
 * Ask the model for crossword-suitable clue/answer pairs. Results are NOT saved
 * — an admin reviews them and submits the ones they want through the normal
 * create endpoint.
 */
export async function draftEntries(input: AiDraftInput): Promise<DraftedEntry[]> {
  if (!isAiEnabled()) {
    throw new AiDisabledError("AI drafting is disabled (ANTHROPIC_API_KEY not set)");
  }

  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const { object } = await generateObject({
    model: anthropic(env.AI_MODEL),
    schema: draftSchema,
    prompt: [
      `Generate ${input.count} crossword clue/answer pairs.`,
      `Language: ${input.languageCode}. Topic: "${input.topic}".`,
      input.categoryName ? `Category: ${input.categoryName}.` : "",
      `Answers must be single words or tightly joined phrases, 3-15 letters,`,
      `common enough for a general audience, no proper-noun-only obscurities.`,
      `Clues must be concise and unambiguous. difficulty is 1 (easy) to 5 (hard).`,
      `Do not number the clues.`,
    ]
      .filter(Boolean)
      .join(" "),
  });

  return object.entries.filter((e) => isPlaceableAnswer(normalizeAnswer(e.answer)));
}
