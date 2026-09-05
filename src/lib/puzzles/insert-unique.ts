import { generatePuzzleSlug } from "@/lib/puzzle-slug";

/** Postgres unique-violation, however the driver wraps it. */
function isSlugCollision(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } })?.code;
  const causeCode = (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505" || causeCode === "23505";
}

/**
 * Insert with a fresh random slug, retrying the (vanishingly rare) collision
 * with the unique index rather than handing the caller a failed generation.
 */
export async function insertUniquePuzzle(
  insert: (slug: string) => Promise<string>,
  attempts = 5,
): Promise<{ id: string; slug: string }> {
  for (let attempt = 0; ; attempt++) {
    const slug = generatePuzzleSlug();
    try {
      return { id: await insert(slug), slug };
    } catch (error) {
      if (attempt >= attempts - 1 || !isSlugCollision(error)) throw error;
    }
  }
}
