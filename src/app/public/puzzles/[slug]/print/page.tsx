import { notFound } from "next/navigation";
import { getPuzzleBySlug } from "@/lib/puzzles";
import { PrintView } from "./PrintView";
import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PrintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const puzzle = await getPuzzleBySlug(slug);
  if (!puzzle) notFound();

  const messages = getMessages(await getRequestLocale());

  return <PrintView puzzle={puzzle} messages={messages} />;
}
