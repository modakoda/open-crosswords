"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category } from "./AdminDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
      >
        <Input
          className="sm:col-span-2"
          placeholder="Clue"
          value={clue}
          onChange={(e) => setClue(e.target.value)}
          required
        />
        <Input
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          required
        />
        <Input
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
        <Select
          value={String(difficulty)}
          onValueChange={(v) => setDifficulty(Number(v))}
        >
          <SelectTrigger className="w-full">
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
        <Button className="sm:col-span-2">Add entry</Button>
      </form>

      {msg && <p className="text-sm text-destructive">{msg}</p>}

      <Input
        placeholder="Search clue or answer…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <p className="text-sm text-muted-foreground">{total} entries</p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clue</TableHead>
            <TableHead>Answer</TableHead>
            <TableHead>Cat</TableHead>
            <TableHead>Diff</TableHead>
            <TableHead>Used</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-normal">{e.clue}</TableCell>
              <TableCell className="font-mono">{e.answerNormalized}</TableCell>
              <TableCell>{catName(e.categoryId)}</TableCell>
              <TableCell>{e.difficulty}</TableCell>
              <TableCell>{e.timesUsed}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" className="mr-1" onClick={() => toggle(e)}>
                  {e.enabled ? "Disable" : "Enable"}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => remove(e.id)}>
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
