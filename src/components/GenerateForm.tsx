"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getMessages, resolveLocale, type Locale } from "@/lib/i18n";

interface Language {
  code: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
}

export function GenerateForm({ initialLocale }: { initialLocale: Locale }) {
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [language, setLanguage] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paperSize, setPaperSize] = useState("a4");
  const [orientation, setOrientation] = useState("portrait");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = getMessages(resolveLocale(language, initialLocale)).generateForm;

  useEffect(() => {
    fetch("/api/languages")
      .then((r) => r.json())
      .then((d: { languages: Language[] }) => {
        setLanguages(d.languages);
        if (d.languages[0]) setLanguage(d.languages[0].code);
      })
      .catch(() => setError(getMessages(initialLocale).generateForm.loadError));
    // Runs once on mount — `initialLocale` is fixed for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!language) return;
    setSelected(new Set());
    fetch(`/api/categories?languageCode=${encodeURIComponent(language)}`)
      .then((r) => r.json())
      .then((d: { categories: Category[] }) => setCategories(d.categories))
      .catch(() => setCategories([]));
  }, [language]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/puzzles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          languageCode: language,
          categoryIds: selected.size ? [...selected] : undefined,
          paperSize,
          orientation,
          title: title.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.genericError);
      router.push(`/puzzles/${data.puzzle.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.genericError);
    } finally {
      setBusy(false);
    }
  }

  if (languages.length === 0) {
    return <p className="text-muted-foreground">{error ?? t.noLanguages}</p>;
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="language">{t.language}</Label>
        <Select value={language} onValueChange={setLanguage}>
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
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">
          {t.categories} {selected.size ? `(${selected.size})` : `(${t.all})`}
        </legend>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && (
            <span className="text-sm text-muted-foreground">{t.noCategories}</span>
          )}
          {categories.map((c) => (
            <Button
              key={c.id}
              type="button"
              size="sm"
              variant={selected.has(c.id) ? "secondary" : "outline"}
              onClick={() => toggle(c.id)}
              className={cn(selected.has(c.id) && "border-primary/40 text-primary")}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="paper-size">{t.paperSize}</Label>
          <Select value={paperSize} onValueChange={setPaperSize}>
            <SelectTrigger id="paper-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(t.paper) as [keyof typeof t.paper, string][]).map(
                ([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="orientation">{t.orientation}</Label>
          <Select value={orientation} onValueChange={setOrientation}>
            <SelectTrigger id="orientation" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">{t.portrait}</SelectItem>
              <SelectItem value="landscape">{t.landscape}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">{t.title}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.titlePlaceholder}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={generate} disabled={busy || !language}>
        {busy ? t.generating : t.generate}
      </Button>
    </div>
  );
}
