"use client";

import { useEffect, useState } from "react";
import { TriangleAlertIcon } from "lucide-react";

import type { Category, Language } from "./workspace";
import type { Entry } from "./EntryTable";
import { EntryFields, type EntryValues } from "./EntryFields";
import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BLANK: EntryValues = { clue: "", answer: "", difficulty: 3, categoryName: "" };

/**
 * Create or edit one library entry. `entry` picks the mode: absent it creates
 * in the working language, present it patches that row in the row's own
 * language — which need not be the working one, since the listing can span
 * every language.
 */
export function EntryFormDialog({
  open,
  onOpenChange,
  language,
  languages,
  categories,
  entry,
  onSaved,
  onCategoryCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
  languages: Language[];
  categories: Category[];
  entry?: Entry | null;
  onSaved: () => void;
  onCategoryCreated: () => void;
}) {
  const [values, setValues] = useState<EntryValues>(BLANK);
  // The language the entry ends up in. Only editing can move it — a new entry
  // belongs to the working language, which is what the view is scoped to.
  const [target, setTarget] = useState(language);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Categories of the edited row's language, when it isn't the working one.
  const [fetched, setFetched] = useState<{ code: string; rows: Category[] } | null>(null);

  const options =
    target === language ? categories : fetched?.code === target ? fetched.rows : [];

  // Loading the row's values during render rather than in an effect keeps the
  // dialog from flashing the previous row's on the way in.
  const key = open ? (entry?.id ?? "new") : null;
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (key !== lastKey) {
    setLastKey(key);
    setTarget(entry?.languageCode ?? language);
    setValues(
      entry
        ? {
            clue: entry.clue,
            answer: entry.answer,
            difficulty: entry.difficulty,
            categoryName: entry.categoryName ?? "",
          }
        : BLANK,
    );
    setMsg(null);
  }

  useEffect(() => {
    if (!open || target === language) return;
    let cancelled = false;
    orpc.categories
      .list({ languageCode: target })
      .then((d) => !cancelled && setFetched({ code: target, rows: d.categories }))
      .catch(() => !cancelled && setFetched({ code: target, rows: [] }));
    return () => {
      cancelled = true;
    };
  }, [open, target, language]);

  /**
   * The category is typed, not picked, so a name that doesn't exist yet has to
   * be created; `ensureCategory` behind `categories.create` is idempotent, so an
   * existing name resolves to its own row. An empty name means "no category" —
   * which is how an edit clears one.
   */
  async function resolveCategoryId(): Promise<string | null> {
    const name = values.categoryName.trim();
    if (!name) return null;
    const existing = options.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const { category } = await orpc.admin.categories.create({ languageCode: target, name });
    onCategoryCreated();
    return category.id;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      let categoryId: string | null;
      try {
        categoryId = await resolveCategoryId();
      } catch {
        // The entry itself is still worth saving. Its existing category can
        // only stay if the entry isn't moving — categories don't cross
        // languages, and the server rejects one that doesn't match.
        categoryId = entry && target === entry.languageCode ? entry.categoryId : null;
      }
      const { clue, answer, difficulty } = values;
      if (entry) {
        await orpc.admin.entries.update({
          id: entry.id,
          patch: { clue, answer, difficulty, categoryId, languageCode: target },
        });
      } else {
        await orpc.admin.entries.create({
          languageCode: language,
          clue,
          answer,
          difficulty,
          categoryId,
        });
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save entry");
      return;
    } finally {
      setSaving(false);
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Edit entry" : "New entry"}</DialogTitle>
          <DialogDescription>
            {entry ? "Saved to" : "Added to"} the <strong>{target}</strong> library.
          </DialogDescription>
        </DialogHeader>
        <form id="entry-form" onSubmit={save} className="space-y-3">
          <EntryFields
            value={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            categories={options}
            // Moving an entry leaves its category behind, so the name typed
            // here is resolved against — and if new, created in — the language
            // picked, not the one the entry came from.
            languages={entry ? languages : undefined}
            language={target}
            onLanguageChange={setTarget}
          />
          {msg && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertDescription>{msg}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button type="submit" form="entry-form" disabled={saving}>
            {entry ? "Save changes" : "Add entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
