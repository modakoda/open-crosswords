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

interface Language {
  code: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
}

const PAPER = [
  ["a4", "A4"],
  ["letter", "US Letter"],
  ["a5", "A5"],
  ["legal", "US Legal"],
] as const;

export function GenerateForm() {
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

  useEffect(() => {
    fetch("/api/languages")
      .then((r) => r.json())
      .then((d: { languages: Language[] }) => {
        setLanguages(d.languages);
        if (d.languages[0]) setLanguage(d.languages[0].code);
      })
      .catch(() => setError("Could not load languages"));
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
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      router.push(`/puzzles/${data.puzzle.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  if (languages.length === 0) {
    return (
      <p className="text-muted-foreground">
        {error ??
          "No languages yet. Seed the database (npm run seed) or add entries in Admin."}
      </p>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="language">Language</Label>
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
          Categories {selected.size ? `(${selected.size})` : "(all)"}
        </legend>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && (
            <span className="text-sm text-muted-foreground">No categories</span>
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
          <Label htmlFor="paper-size">Paper size</Label>
          <Select value={paperSize} onValueChange={setPaperSize}>
            <SelectTrigger id="paper-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPER.map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="orientation">Orientation</Label>
          <Select value={orientation} onValueChange={setOrientation}>
            <SelectTrigger id="orientation" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Friday night crossword"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={generate} disabled={busy || !language}>
        {busy ? "Generating…" : "Generate crossword"}
      </Button>
    </div>
  );
}
