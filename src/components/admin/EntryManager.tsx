"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category } from "./AdminDashboard";

interface Entry {
  id: string;
  clue: string;
  answer: string;
  answerNormalized: string;
  difficulty: number;
  enabled: number;
  categoryId: string | null;
  timesUsed: number;
}

export function EntryManager({
  language,
  categories,
  onCategoriesChanged,
}: {
  language: string;
  categories: Category[];
  onCategoriesChanged: () => void;
}) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [clue, setClue] = useState("");
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [categoryName, setCategoryName] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams({ languageCode: language, limit: "100" });
    if (q) params.set("q", q);
    fetch(`/api/admin/entries?${params}`)
      .then((r) => r.json())
      .then((d: { rows: Entry[]; total: number }) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setMsg("Failed to load entries"));
  }, [language, q]);

  useEffect(load, [load]);

  async function createEntry(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    let categoryId: string | undefined;
    if (categoryName.trim()) {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ languageCode: language, name: categoryName.trim() }),
      });
      if (res.ok) {
        categoryId = (await res.json()).category.id;
        onCategoriesChanged();
      }
    }
    const res = await fetch("/api/admin/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        languageCode: language,
        clue,
        answer,
        difficulty,
        categoryId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Could not create entry");
      return;
    }
    setClue("");
    setAnswer("");
    setCategoryName("");
    load();
  }

  async function toggle(entry: Entry) {
    await fetch(`/api/admin/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: entry.enabled === 0 }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/admin/entries/${id}`, { method: "DELETE" });
    load();
  }

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <form
        onSubmit={createEntry}
        className="grid gap-2 rounded border border-slate-200 p-3 sm:grid-cols-2"
      >
        <input
          className="field sm:col-span-2"
          placeholder="Clue"
          value={clue}
          onChange={(e) => setClue(e.target.value)}
          required
        />
        <input
          className="field"
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          required
        />
        <input
          className="field"
          list="cat-list"
          placeholder="Category (optional)"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
        />
        <datalist id="cat-list">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <label className="text-sm">
          Difficulty{" "}
          <select
            className="field"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button className="btn">Add entry</button>
      </form>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <input
        className="field w-full"
        placeholder="Search clue or answer…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <p className="text-sm text-slate-500">{total} entries</p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1">Clue</th>
            <th>Answer</th>
            <th>Cat</th>
            <th>Diff</th>
            <th>Used</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-t border-slate-100">
              <td className="py-1 pr-2">{e.clue}</td>
              <td className="font-mono">{e.answerNormalized}</td>
              <td>{catName(e.categoryId)}</td>
              <td>{e.difficulty}</td>
              <td>{e.timesUsed}</td>
              <td className="whitespace-nowrap text-right">
                <button className="btn mr-1" onClick={() => toggle(e)}>
                  {e.enabled ? "Disable" : "Enable"}
                </button>
                <button className="btn" onClick={() => remove(e.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
