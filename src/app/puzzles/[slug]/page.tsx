import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPuzzleBySlug } from "@/lib/puzzles";
import { SolveView } from "@/components/SolveView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const puzzle = await getPuzzleBySlug(slug);
  return { title: puzzle ? `${puzzle.title} — Open Crosswords` : "Puzzle not found" };
}

export default async function PuzzlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const puzzle = await getPuzzleBySlug(slug);
  if (!puzzle) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{puzzle.title}</h1>
        <p className="text-sm text-slate-500">
          {puzzle.width}×{puzzle.height} · {puzzle.clues.across.length} across ·{" "}
          {puzzle.clues.down.length} down · share this page to let others solve it
        </p>
      </div>
      <SolveView puzzle={puzzle} />
    </div>
  );
}
