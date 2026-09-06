"use client";

import { EntryManager } from "@/components/admin/EntryManager";
import { useAdminWorkspace } from "@/components/admin/workspace";

export default function AdminEntriesPage() {
  const { language, languages, categories, reloadCategories } =
    useAdminWorkspace();

  return (
    <EntryManager
      language={language}
      languages={languages}
      categories={categories}
      onCategoriesChanged={reloadCategories}
    />
  );
}
