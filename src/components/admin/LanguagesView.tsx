"use client";

import { LanguageManager } from "./LanguageManager";
import { useAdminWorkspace } from "./workspace";

export function LanguagesView() {
  const { language, setLanguage, reloadLanguages } = useAdminWorkspace();
  return (
    <LanguageManager
      language={language}
      onLanguageChange={setLanguage}
      onLanguagesChanged={reloadLanguages}
    />
  );
}
