"use client";

import { AdminLanguageBar } from "./AdminLanguageBar";
import { AiDraftPanel } from "./AiDraftPanel";
import { useAdminWorkspace } from "./workspace";

/** Drafting writes into one language too, so it carries its own picker. */
export function AiDraftView() {
  const { language, categories, aiEnabled } = useAdminWorkspace();
  return (
    <div className="space-y-5">
      <AdminLanguageBar />
      <AiDraftPanel
        language={language}
        categories={categories}
        aiEnabled={aiEnabled}
      />
    </div>
  );
}
