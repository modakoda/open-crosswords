"use client";

import { ImportPanel } from "@/components/admin/ImportPanel";
import { useAdminWorkspace } from "@/components/admin/workspace";

export default function AdminImportPage() {
  const { language, reloadCategories } = useAdminWorkspace();
  return <ImportPanel language={language} onDone={reloadCategories} />;
}
