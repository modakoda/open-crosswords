"use client";

import { EntryManager } from "./EntryManager";
import { useAdminWorkspace } from "./workspace";

export function EntriesView() {
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
