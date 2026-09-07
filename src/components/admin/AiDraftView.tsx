"use client";

import { AiDraftPanel } from "./AiDraftPanel";
import { useAdminWorkspace } from "./workspace";

export function AiDraftView() {
  const { language, categories, aiEnabled } = useAdminWorkspace();
  return (
    <AiDraftPanel
      language={language}
      categories={categories}
      aiEnabled={aiEnabled}
    />
  );
}
