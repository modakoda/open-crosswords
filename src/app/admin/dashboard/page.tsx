import { redirect } from "next/navigation";

<<<<<<< Updated upstream
import { getAdmin } from "@/lib/auth-guard";
import { ADMIN_BASE_PATH, DEFAULT_ADMIN_VIEW } from "@/components/admin/views";
import { LANGUAGE_CODE } from "@/lib/validation/schemas";

/**
 * The dashboard root is an alias for its first view. It carries `?lang=`
 * through so a link to the root opens scoped, but validates it here rather
 * than forwarding whatever arrived — Next hands back `string[]` for a repeated
 * param, and `AdminShell` would only have to discard it a moment later.
 */
export default async function AdminDashboardIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!(await getAdmin())) redirect("/admin/login");

  const { lang } = await searchParams;
  const parsed = LANGUAGE_CODE.safeParse(Array.isArray(lang) ? lang[0] : lang);
  const query = parsed.success ? `?lang=${encodeURIComponent(parsed.data)}` : "";

=======
import { ADMIN_BASE_PATH, DEFAULT_ADMIN_VIEW } from "@/components/admin/AdminNav";

/** The dashboard root is just an alias for its first view. */
export default async function AdminDashboardIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : "";
>>>>>>> Stashed changes
  redirect(`${ADMIN_BASE_PATH}/${DEFAULT_ADMIN_VIEW}${query}`);
}
