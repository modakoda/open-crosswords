"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { EntryManager } from "./EntryManager";
import { ImportPanel } from "./ImportPanel";
import { AiDraftPanel } from "./AiDraftPanel";

export interface Language {
  code: string;
  name: string;
}
export interface Category {
  id: string;
  name: string;
}

type Tab = "entries" | "import" | "ai";

export function AdminDashboard({ aiEnabled }: { aiEnabled: boolean }) {
  const [tab, setTab] = useState<Tab>("entries");
  const [languages, setLanguages] = useState<Language[]>([]);
  const [language, setLanguage] = useState("en");
  const [newLang, setNewLang] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  function reloadLanguages() {
    fetch("/api/languages")
      .then((r) => r.json())
      .then((d: { languages: Language[] }) => {
        setLanguages(d.languages);
        if (d.languages.length && !d.languages.some((l) => l.code === language)) {
          setLanguage(d.languages[0].code);
        }
      });
  }
  function reloadCategories() {
    fetch(`/api/categories?languageCode=${encodeURIComponent(language)}`)
      .then((r) => r.json())
      .then((d: { categories: Category[] }) => setCategories(d.categories))
      .catch(() => setCategories([]));
  }

  useEffect(reloadLanguages, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reloadCategories, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">
          Language{" "}
          <select
            className="field"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.code})
              </option>
            ))}
            {languages.length === 0 && <option value="en">English (en)</option>}
          </select>
        </label>
        <span className="flex items-center gap-1">
          <input
            className="field w-24"
            placeholder="add e.g. lt"
            value={newLang}
            onChange={(e) => setNewLang(e.target.value)}
          />
          <button
            className="btn"
            onClick={() => {
              const code = newLang.trim().toLowerCase();
              if (code) {
                setLanguage(code);
                setNewLang("");
              }
            }}
          >
            Use
          </button>
        </span>
        <button
          className="btn ml-auto"
          onClick={() => signOut().then(() => location.assign("/admin/login"))}
        >
          Sign out
        </button>
      </div>

      <nav className="flex gap-2 border-b border-slate-200">
        {(
          [
            ["entries", "Entries"],
            ["import", "Bulk import"],
            ["ai", "AI draft"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm ${
              tab === id
                ? "border-b-2 border-slate-800 font-semibold"
                : "text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "entries" && (
        <EntryManager
          language={language}
          categories={categories}
          onCategoriesChanged={reloadCategories}
        />
      )}
      {tab === "import" && (
        <ImportPanel language={language} onDone={reloadCategories} />
      )}
      {tab === "ai" && (
        <AiDraftPanel
          language={language}
          categories={categories}
          aiEnabled={aiEnabled}
        />
      )}
    </div>
  );
}
