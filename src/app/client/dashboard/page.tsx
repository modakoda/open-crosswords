import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth-guard";
import { listPuzzlesForUser } from "@/lib/puzzles";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ClientDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/client/login");

  const [puzzles, locale] = await Promise.all([
    listPuzzlesForUser(user.id),
    getRequestLocale(),
  ]);
  const messages = getMessages(locale);

  return <ClientDashboard email={user.email} puzzles={puzzles} messages={messages.client} />;
}
