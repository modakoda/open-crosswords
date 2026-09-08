"use client";

import { useAdminWorkspace } from "./workspace";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The working-language picker, rendered by the view that needs it rather than
 * by the shell — so it sits below the nav, inside the screen it acts on, and
 * only the screens whose whole action is scoped to one language carry it.
 * Entries, puzzles and the languages view set the same `?lang=` from their own
 * toolbar, so a second control here would be two ways to set one thing.
 * Creating and renaming languages is the Languages view's job; the account and
 * sign-out live in the header's user menu, not here.
 */
export function AdminLanguageBar() {
  const { language, languages, setLanguage } = useAdminWorkspace();

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Working language
          </label>
          <Select value={language} onValueChange={setLanguage}>
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
