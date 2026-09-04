import { redirect } from "next/navigation";
import { LibraryBigIcon } from "lucide-react";

import { getAdmin } from "@/lib/auth-guard";
import { isAiEnabled } from "@/lib/env";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Badge } from "@/components/ui/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
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
        <Badge variant="outline" className="font-normal">
          {admin.email}
        </Badge>
      </header>
      <AdminDashboard aiEnabled={isAiEnabled()} />
    </div>
  );
}
