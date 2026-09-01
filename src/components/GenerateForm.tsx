"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
      <p className="text-slate-600">
        {error ??
          "No languages yet. Seed the database (npm run seed) or add entries in Admin."}
      </p>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Language</span>
        <select
          className="field mt-1 block w-full"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="text-sm font-medium">
          Categories {selected.size ? `(${selected.size})` : "(all)"}
        </legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {categories.length === 0 && (
            <span className="text-sm text-slate-500">No categories</span>
          )}
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={`btn ${selected.has(c.id) ? "!bg-amber-200" : ""}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-4">
        <label className="block flex-1">
          <span className="text-sm font-medium">Paper size</span>
          <select
            className="field mt-1 block w-full"
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
          >
            {PAPER.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1">
          <span className="text-sm font-medium">Orientation</span>
          <select
            className="field mt-1 block w-full"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Title (optional)</span>
        <input
          className="field mt-1 block w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Friday night crossword"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button className="btn" onClick={generate} disabled={busy || !language}>
        {busy ? "Generating…" : "Generate crossword"}
      </button>
    </div>
  );
}
