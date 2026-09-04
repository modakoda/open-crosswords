"use client";

import { useState } from "react";
import { LoaderCircleIcon, SparklesIcon, WandSparklesIcon } from "lucide-react";

import type { Category } from "./AdminDashboard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
      <Alert>
        <WandSparklesIcon />
        <AlertTitle>AI drafting is disabled</AlertTitle>
        <AlertDescription>
          Set <code>ANTHROPIC_API_KEY</code> (and optionally <code>AI_MODEL</code>)
          in the environment to enable it.
        </AlertDescription>
      </Alert>
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

  const allKept = drafts.length > 0 && keep.size === drafts.length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="ai-topic">Topic</Label>
          <Input
            id="ai-topic"
            placeholder="e.g. World capitals"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-count">Count</Label>
          <Input
            id="ai-count"
            className="w-20"
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-cat">Category</Label>
          <Input
            id="ai-cat"
            list="ai-cat-list"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <datalist id="ai-cat-list">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div className="flex items-end">
          <Button onClick={generate} disabled={busy || topic.length < 2}>
            {busy ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <SparklesIcon />
            )}
            {busy ? "Working…" : "Draft"}
          </Button>
        </div>
      </div>

      {msg && (
        <Alert>
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      {drafts.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <Checkbox
              checked={allKept}
              onCheckedChange={(c) =>
                setKeep(c ? new Set(drafts.map((_, i) => i)) : new Set())
              }
              aria-label="Select all drafts"
            />
            <span className="text-sm font-medium">Drafts</span>
            <Badge variant="secondary" className="tabular-nums">
              {keep.size} / {drafts.length}
            </Badge>
          </div>
          <Separator />
          <ul className="divide-y divide-border">
            {drafts.map((d, i) => (
              <li key={i}>
                <Label className="flex items-start gap-3 px-3 py-2.5 font-normal hover:bg-muted/40">
                  <Checkbox
                    className="mt-0.5"
                    checked={keep.has(i)}
                    onCheckedChange={(checked) => {
                      const next = new Set(keep);
                      checked ? next.add(i) : next.delete(i);
                      setKeep(next);
                    }}
                  />
                  <span className="text-sm">
                    <strong className="font-mono">{d.answer}</strong>
                    <span className="mx-1 text-muted-foreground">·</span>
                    {d.clue}
                    <Badge variant="outline" className="ml-2 font-normal">
                      d{d.difficulty}
                    </Badge>
                  </span>
                </Label>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="px-3 py-2">
            <Button onClick={saveKept} disabled={busy || keep.size === 0}>
              Save {keep.size} selected
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
