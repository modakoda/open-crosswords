import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth-guard";
import { isAiEnabled } from "@/lib/env";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Question library</h1>
        <span className="text-sm text-slate-500">{admin.email}</span>
      </div>
      <AdminDashboard aiEnabled={isAiEnabled()} />
    </div>
  );
}
