"use client";

import type { Category, Language } from "./workspace";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The editable shape of a library entry, shared by the create and edit forms. */
export interface EntryValues {
  clue: string;
  answer: string;
  difficulty: number;
  categoryName: string;
}

/**
 * The field group of `EntryFormDialog`. Categories are typed against a datalist
 * rather than picked from a list, so a new one can be named inline.
 */
export function EntryFields({
  value,
  onChange,
  categories,
  languages,
  language,
  onLanguageChange,
}: {
  value: EntryValues;
  onChange: (patch: Partial<EntryValues>) => void;
  categories: Category[];
  /** Omitted where the language is fixed — a new entry takes the working one. */
  languages?: Language[];
  language: string;
  onLanguageChange: (code: string) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="e-clue">Clue</Label>
        <Input
          id="e-clue"
          value={value.clue}
          onChange={(e) => onChange({ clue: e.target.value })}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="e-answer">Answer</Label>
          <Input
            id="e-answer"
            value={value.answer}
            onChange={(e) => onChange({ answer: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-cat">Category (optional)</Label>
          <Input
            id="e-cat"
            list="cat-list"
            value={value.categoryName}
            onChange={(e) => onChange({ categoryName: e.target.value })}
          />
          <datalist id="cat-list">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
      </div>
      <div className={`grid gap-3 ${languages ? "sm:grid-cols-2" : ""}`}>
        {languages && (
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select value={language} onValueChange={onLanguageChange}>
              <SelectTrigger className="w-full" aria-label="Language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.name} ({l.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Difficulty</Label>
          <Select
            value={String(value.difficulty)}
            onValueChange={(v) => onChange({ difficulty: Number(v) })}
          >
            <SelectTrigger className="w-full" aria-label="Difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Difficulty {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}
