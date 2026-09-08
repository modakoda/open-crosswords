"use client";

import { AdminLanguageBar } from "./AdminLanguageBar";
import { ImportPanel } from "./ImportPanel";
import { useAdminWorkspace } from "./workspace";

/**
 * Bulk import files every pasted row under one language, so the picker for it
 * belongs to this screen — below the nav, above the paste box it governs.
 */
export function ImportView() {
  const { language, reloadCategories } = useAdminWorkspace();
  return (
    <div className="space-y-5">
      <AdminLanguageBar />
      <ImportPanel language={language} onDone={reloadCategories} />
    </div>
  );
}
