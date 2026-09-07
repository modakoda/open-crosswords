"use client";

import type { Language } from "./workspace";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The admin chrome's working-language picker, shown only to the views that
 * have no language filter of their own (`usesWorkingLanguagePicker`) — so the
 * bar disappears entirely for the rest. Creating and renaming languages is the
 * Languages view's job; the account and sign-out live in the header's user
 * menu, not here.
 */
export function AdminLanguageBar({
  language,
  languages,
  showLanguage,
  onLanguageChange,
}: {
  language: string;
  languages: Language[];
  showLanguage: boolean;
  onLanguageChange: (code: string) => void;
}) {
  if (!showLanguage) return null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Working language
          </label>
          <Select value={language} onValueChange={onLanguageChange}>
            <SelectTrigger className="w-48" aria-label="Working language">
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
      </CardContent>
    </Card>
  );
}
