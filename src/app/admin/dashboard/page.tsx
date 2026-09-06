import { redirect } from "next/navigation";

import { ADMIN_BASE_PATH, DEFAULT_ADMIN_VIEW } from "@/components/admin/AdminNav";

/** The dashboard root is just an alias for its first view. */
export default async function AdminDashboardIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  redirect(`${ADMIN_BASE_PATH}/${DEFAULT_ADMIN_VIEW}${query}`);
}
