"use client";

import { useState } from "react";
import { LoaderCircleIcon, SparklesIcon, WandSparklesIcon } from "lucide-react";

import type { Category } from "./workspace";
import { DraftList, type Draft } from "./DraftList";
import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
      const data = await orpc.admin.entries.aiDraft({
        languageCode: language,
        topic,
        count,
        categoryName: categoryName || undefined,
      });
      setDrafts(data.drafts);
      setKeep(new Set(data.drafts.map((_, i) => i)));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Draft request failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveKept() {
    setBusy(true);
    let categoryId: string | undefined;
    if (categoryName.trim()) {
      try {
        const { category } = await orpc.admin.categories.create({
          languageCode: language,
          name: categoryName.trim(),
        });
        categoryId = category.id;
      } catch {
        /* fall through — drafts can still be saved without a category */
      }
    }
    let saved = 0;
    for (let i = 0; i < drafts.length; i++) {
      if (!keep.has(i)) continue;
      try {
        await orpc.admin.entries.create({
          languageCode: language,
          clue: drafts[i].clue,
          answer: drafts[i].answer,
          difficulty: drafts[i].difficulty,
          categoryId,
          source: "ai",
        });
        saved++;
      } catch {
        /* skip this draft, continue saving the rest */
      }
    }
    setBusy(false);
    setMsg(`Saved ${saved} entries.`);
    setDrafts([]);
  }

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
        <DraftList drafts={drafts} keep={keep} onKeepChange={setKeep} busy={busy} onSave={saveKept} />
      )}
    </div>
  );
}
