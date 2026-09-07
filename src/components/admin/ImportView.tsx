"use client";

import { ImportPanel } from "./ImportPanel";
import { useAdminWorkspace } from "./workspace";

export function ImportView() {
  const { language, reloadCategories } = useAdminWorkspace();
  return <ImportPanel language={language} onDone={reloadCategories} />;
}
