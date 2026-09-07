"use client";

import { createContext, useContext } from "react";

export interface Language {
  code: string;
  name: string;
}
export interface Category {
  id: string;
  name: string;
}

/**
 * Everything the admin views share: the working language (which lives in the
 * URL, so every view is linkable and reload-safe) plus the lists each view
 * filters by. `AdminShell` owns the state; the per-route pages read it here.
 */
export interface AdminWorkspace {
  languages: Language[];
  /** Re-reads the language list after the languages view changes it. */
  reloadLanguages: () => void;
  /** The working language — governs what newly created rows belong to. */
  language: string;
  /** Moves the working language, which lives in the URL rather than state. */
  setLanguage: (code: string) => void;
  categories: Category[];
  reloadCategories: () => void;
  aiEnabled: boolean;
}

const AdminWorkspaceContext = createContext<AdminWorkspace | null>(null);

export const AdminWorkspaceProvider = AdminWorkspaceContext.Provider;

export function useAdminWorkspace(): AdminWorkspace {
  const value = useContext(AdminWorkspaceContext);
  if (!value) {
    throw new Error("useAdminWorkspace must be used inside <AdminShell>");
  }
  return value;
}
