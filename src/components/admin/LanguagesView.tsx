"use client";

import { LanguageManager } from "./LanguageManager";
import { useAdminWorkspace } from "./workspace";

export function LanguagesView() {
  const { reloadLanguages } = useAdminWorkspace();
  return <LanguageManager onLanguagesChanged={reloadLanguages} />;
}
