import { getPuzzleBySlug } from "@/lib/puzzles";
import { apiError, json } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(slug)) return apiError(400, "Bad slug");
  const puzzle = await getPuzzleBySlug(slug);
  if (!puzzle) return apiError(404, "Puzzle not found");
  return json({ puzzle });
}
