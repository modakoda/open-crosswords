"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";

import { signOut } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/client";
import type { Language } from "./workspace";
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

export function AdminLanguageBar({
  language,
  languages,
  onLanguageChange,
  onLanguagesChanged,
}: {
  language: string;
  languages: Language[];
  onLanguageChange: (code: string) => void;
  onLanguagesChanged: (languages: Language[]) => void;
}) {
  const router = useRouter();
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [newLang, setNewLang] = useState("");
  const [langError, setLangError] = useState<string | null>(null);
  const [addingLang, setAddingLang] = useState(false);

  // The code has to reach the `languages` table before it can be selected —
  // setting local state alone would leave the Select with nothing to show.
  async function handleAddLanguage() {
    const code = newLang.trim().toLowerCase();
    if (!code || addingLang) return;
    setAddingLang(true);
    setLangError(null);
    try {
      const d = await orpc.admin.languages.create({ code });
      onLanguagesChanged(d.languages);
      onLanguageChange(code);
      setNewLang("");
    } catch {
      setLangError("Could not add that language. Use a code like 'lt'.");
    } finally {
      setAddingLang(false);
    }
  }

  // better-auth's client resolves to `{ data, error }` rather than throwing,
  // so a rejected sign-out (its rate limit covers /sign-out too) would
  // otherwise land on the login page with the session cookie still live.
  async function handleSignOut() {
    const result = await signOut();
    if (result?.error) {
      setSignOutFailed(true);
      return;
    }
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Working language
          </label>
          <Select value={language} onValueChange={onLanguageChange}>
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
                <SelectItem value={language}>{language}</SelectItem>
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
              onChange={(e) => {
                setNewLang(e.target.value);
                setLangError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddLanguage();
              }}
            />
            <Button
              variant="outline"
              disabled={addingLang || !newLang.trim()}
              onClick={handleAddLanguage}
            >
              {addingLang ? "Adding..." : "Add"}
            </Button>
          </div>
          {langError && (
            <p role="alert" className="text-xs text-destructive">
              {langError}
            </p>
          )}
        </div>

        <Separator orientation="vertical" className="mx-1 hidden h-9 sm:block" />

        <Button
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOutIcon />
          Sign out
        </Button>
        {signOutFailed && (
          <span role="alert" className="text-sm text-destructive">
            Sign out failed. Please try again.
          </span>
        )}
      </CardContent>
    </Card>
  );
}
