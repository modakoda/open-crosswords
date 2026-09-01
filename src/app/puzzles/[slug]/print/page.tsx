import { notFound } from "next/navigation";
import { getPuzzleBySlug } from "@/lib/puzzles";
import { PrintView } from "./PrintView";

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

  return <PrintView puzzle={puzzle} />;
}
