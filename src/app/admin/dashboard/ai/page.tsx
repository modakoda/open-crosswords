"use client";

import { AiDraftPanel } from "@/components/admin/AiDraftPanel";
import { useAdminWorkspace } from "@/components/admin/workspace";

export default function AdminAiDraftPage() {
  const { language, categories, aiEnabled } = useAdminWorkspace();
  return (
    <AiDraftPanel
      language={language}
      categories={categories}
      aiEnabled={aiEnabled}
    />
  );
}
