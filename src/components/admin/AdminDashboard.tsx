"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { EntryManager } from "./EntryManager";
import { ImportPanel } from "./ImportPanel";
import { AiDraftPanel } from "./AiDraftPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name} ({l.code})
              </SelectItem>
            ))}
            {languages.length === 0 && (
              <SelectItem value="en">English (en)</SelectItem>
            )}
          </SelectContent>
        </Select>
        <span className="flex items-center gap-1">
          <Input
            className="w-24"
            placeholder="add e.g. lt"
            value={newLang}
            onChange={(e) => setNewLang(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={() => {
              const code = newLang.trim().toLowerCase();
              if (code) {
                setLanguage(code);
                setNewLang("");
              }
            }}
          >
            Use
          </Button>
        </span>
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={() => signOut().then(() => location.assign("/admin/login"))}
        >
          Sign out
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="import">Bulk import</TabsTrigger>
          <TabsTrigger value="ai">AI draft</TabsTrigger>
        </TabsList>
        <TabsContent value="entries">
          <EntryManager
            language={language}
            categories={categories}
            onCategoriesChanged={reloadCategories}
          />
        </TabsContent>
        <TabsContent value="import">
          <ImportPanel language={language} onDone={reloadCategories} />
        </TabsContent>
        <TabsContent value="ai">
          <AiDraftPanel
            language={language}
            categories={categories}
            aiEnabled={aiEnabled}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
