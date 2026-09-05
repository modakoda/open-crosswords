import { generatePuzzleSlug } from "@/lib/puzzle-slug";

/**
 * Postgres unique-violation, however deeply the driver wraps it — Drizzle
 * re-throws the driver error as the `cause` of its own, and that chain grows a
 * link whenever either side changes, so walk it rather than peeling one layer.
 */
function isSlugCollision(error: unknown): boolean {
  for (let e = error, depth = 0; e && depth < 5; depth++) {
    const { code, cause } = e as { code?: string; cause?: unknown };
    if (code === "23505") return true;
    e = cause;
  }
  return false;
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
