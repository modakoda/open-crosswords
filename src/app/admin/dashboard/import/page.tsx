import { redirect } from "next/navigation";

import { getAdmin } from "@/lib/auth-guard";
import { ImportView } from "@/components/admin/ImportView";

/**
 * The gate is re-asserted here, not left to `dashboard/layout.tsx` alone: a
 * client-supplied `Next-Router-State-Tree` can make Next skip a parent
 * layout's render entirely, so a layout guard is chrome, not an authorization
 * boundary. `getAdmin` is `cache()`-wrapped, so this costs nothing.
 */
export default async function AdminImportPage() {
  if (!(await getAdmin())) redirect("/admin/login");
  return <ImportView />;
}
