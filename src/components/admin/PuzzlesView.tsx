"use client";

import { PuzzleManager } from "./PuzzleManager";
import { useAdminWorkspace } from "./workspace";

export function PuzzlesView() {
  const { language, setLanguage, languages } = useAdminWorkspace();
  return (
    <PuzzleManager
      language={language}
      languages={languages}
      onLanguageChange={setLanguage}
    />
  );
}
