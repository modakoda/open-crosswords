"use client";

import { useState } from "react";
import type { Category } from "./AdminDashboard";

interface Draft {
  clue: string;
  answer: string;
  difficulty: number;
}

export function AiDraftPanel({
  language,
  categories,
  aiEnabled,
}: {
  language: string;
  categories: Category[];
  aiEnabled: boolean;
}) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [categoryName, setCategoryName] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!aiEnabled) {
    return (
      <p className="text-sm text-slate-600">
        AI drafting is disabled. Set <code>ANTHROPIC_API_KEY</code> (and
        optionally <code>AI_MODEL</code>) in the environment to enable it.
      </p>
    );
  }

  async function generate() {
    setBusy(true);
    setMsg(null);
    setDrafts([]);
    try {
      const res = await fetch("/api/admin/entries/ai-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          languageCode: language,
          topic,
          count,
          categoryName: categoryName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Draft request failed");
        return;
      }
      setDrafts(data.drafts);
      setKeep(new Set(data.drafts.map((_: Draft, i: number) => i)));
    } finally {
      setBusy(false);
    }
  }

  async function saveKept() {
    setBusy(true);
    let categoryId: string | undefined;
    if (categoryName.trim()) {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ languageCode: language, name: categoryName.trim() }),
      });
      if (res.ok) categoryId = (await res.json()).category.id;
    }
    let saved = 0;
    for (let i = 0; i < drafts.length; i++) {
      if (!keep.has(i)) continue;
      const res = await fetch("/api/admin/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          languageCode: language,
          clue: drafts[i].clue,
          answer: drafts[i].answer,
          difficulty: drafts[i].difficulty,
          categoryId,
          source: "ai",
        }),
      });
      if (res.ok) saved++;
    }
    setBusy(false);
    setMsg(`Saved ${saved} entries.`);
    setDrafts([]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="field flex-1"
          placeholder="Topic, e.g. World capitals"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <input
          className="field w-20"
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
        <input
          className="field"
          list="ai-cat-list"
          placeholder="Category"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
        />
        <datalist id="ai-cat-list">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <button className="btn" onClick={generate} disabled={busy || topic.length < 2}>
          {busy ? "Working…" : "Draft"}
        </button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}

      {drafts.length > 0 && (
        <div className="space-y-2">
          <ul className="space-y-1 text-sm">
            {drafts.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={keep.has(i)}
                  onChange={(e) => {
                    const next = new Set(keep);
                    e.target.checked ? next.add(i) : next.delete(i);
                    setKeep(next);
                  }}
                />
                <span>
                  <strong className="font-mono">{d.answer}</strong> — {d.clue}{" "}
                  <span className="text-slate-400">(d{d.difficulty})</span>
                </span>
              </li>
            ))}
          </ul>
          <button className="btn" onClick={saveKept} disabled={busy}>
            Save {keep.size} selected
          </button>
        </div>
      )}
    </div>
  );
}
