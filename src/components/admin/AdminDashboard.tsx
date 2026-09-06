"use client";

import { useEffect, useState } from "react";
import { LogOutIcon, SparklesIcon, TableIcon, UploadIcon } from "lucide-react";

import { signOut } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/client";
import { EntryManager } from "./EntryManager";
import { ImportPanel } from "./ImportPanel";
import { AiDraftPanel } from "./AiDraftPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    orpc.languages.list().then((d) => {
      setLanguages(d.languages);
      if (d.languages.length && !d.languages.some((l) => l.code === language)) {
        setLanguage(d.languages[0].code);
      }
    });
  }
  function reloadCategories() {
    orpc.categories
      .list({ languageCode: language })
      .then((d) => setCategories(d.categories))
      .catch(() => setCategories([]));
  }

  useEffect(reloadLanguages, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reloadCategories, [language]);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Working language
            </label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-48">
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
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Add a language
            </label>
            <div className="flex items-center gap-1.5">
              <Input
                className="w-28"
                placeholder="e.g. lt"
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
            </div>
          </div>

          <Separator orientation="vertical" className="mx-1 hidden h-9 sm:block" />

          <Button
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={() => signOut().then(() => location.assign("/admin/login"))}
          >
            <LogOutIcon />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="entries">
            <TableIcon />
            Entries
          </TabsTrigger>
          <TabsTrigger value="import">
            <UploadIcon />
            Bulk import
          </TabsTrigger>
          <TabsTrigger value="ai">
            <SparklesIcon />
            AI draft
          </TabsTrigger>
        </TabsList>
        <TabsContent value="entries" className="mt-4">
          <EntryManager
            language={language}
            categories={categories}
            onCategoriesChanged={reloadCategories}
          />
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          <ImportPanel language={language} onDone={reloadCategories} />
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
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
