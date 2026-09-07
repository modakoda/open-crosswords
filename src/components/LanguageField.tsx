"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Messages } from "@/lib/i18n";

export interface Language {
  code: string;
  name: string;
}

export function LanguageField({
  languages,
  language,
  onLanguageChange,
  t,
}: {
  languages: Language[];
  language: string;
  onLanguageChange: (code: string) => void;
  t: Messages["generateForm"];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="language">{t.language}</Label>
      <Select value={language} onValueChange={onLanguageChange}>
        <SelectTrigger id="language" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {languages.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t.languageHint}</p>
    </div>
  );
}
