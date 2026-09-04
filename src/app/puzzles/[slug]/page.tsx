import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPuzzleBySlug } from "@/lib/puzzles";
import { SolveView } from "@/components/SolveView";
import { Badge } from "@/components/ui/badge";
import { getMessages, resolveLocale } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const puzzle = await getPuzzleBySlug(slug);
  if (!puzzle) {
    const locale = await getRequestLocale();
    return { title: getMessages(locale).solve.notFoundTitle };
  }
  return { title: `${puzzle.title} — Open Crosswords` };
}

export default async function PuzzlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const puzzle = await getPuzzleBySlug(slug);
  if (!puzzle) notFound();

  const messages = getMessages(resolveLocale(puzzle.languageCode));

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {puzzle.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary" className="tabular-nums">
            {puzzle.width}×{puzzle.height}
          </Badge>
          <Badge variant="outline" className="tabular-nums font-normal">
            {puzzle.clues.across.length} {messages.clues.across}
          </Badge>
          <Badge variant="outline" className="tabular-nums font-normal">
            {puzzle.clues.down.length} {messages.clues.down}
          </Badge>
          <span className="text-muted-foreground uppercase text-xs tracking-wide">
            {puzzle.languageCode}
          </span>
        </div>
      </header>
      <SolveView puzzle={puzzle} messages={messages} />
    </div>
  );
}
