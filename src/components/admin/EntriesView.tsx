"use client";

import { EntryManager } from "./EntryManager";
import { useAdminWorkspace } from "./workspace";

export function EntriesView() {
  const { language, setLanguage, languages, categories, reloadCategories } =
    useAdminWorkspace();

  return (
    <EntryManager
      language={language}
      languages={languages}
      categories={categories}
      onLanguageChange={setLanguage}
      onCategoriesChanged={reloadCategories}
    />
  );
}
