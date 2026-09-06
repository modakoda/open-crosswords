"use client";

import { PuzzleManager } from "@/components/admin/PuzzleManager";
import { useAdminWorkspace } from "@/components/admin/workspace";

export default function AdminPuzzlesPage() {
  const { language, languages } = useAdminWorkspace();
  return <PuzzleManager language={language} languages={languages} />;
}
