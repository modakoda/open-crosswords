import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LibraryBigIcon } from "lucide-react";

import { getAdmin } from "@/lib/auth-guard";
import { isAiEnabled } from "@/lib/env/server";
import { AdminShell } from "@/components/admin/AdminShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defence in depth only — every page under this layout guards itself, since
  // the caller's router state decides whether this layout renders at all.
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <LibraryBigIcon className="size-4" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Question library
            </h1>
            <p className="text-sm text-muted-foreground">
              Shared clue &amp; answer bank for every generated puzzle.
            </p>
          </div>
        </div>
      </header>
      <Suspense>
        <AdminShell aiEnabled={isAiEnabled()}>{children}</AdminShell>
      </Suspense>
    </div>
  );
}
