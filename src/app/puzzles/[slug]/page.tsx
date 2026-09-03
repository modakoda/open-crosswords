import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPuzzleBySlug } from "@/lib/puzzles";
import { SolveView } from "@/components/SolveView";
import { formatMessage, getMessages, resolveLocale } from "@/lib/i18n";
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{puzzle.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatMessage(messages.solve.meta, {
            width: puzzle.width,
            height: puzzle.height,
            across: puzzle.clues.across.length,
            down: puzzle.clues.down.length,
          })}
        </p>
      </div>
      <SolveView puzzle={puzzle} messages={messages} />
    </div>
  );
}
