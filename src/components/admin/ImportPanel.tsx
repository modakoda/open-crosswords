"use client";

import { useState } from "react";
import {
  CircleCheckIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";

import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const SAMPLE_JSON = `[
  { "clue": "Capital of France", "answer": "Paris", "category": "Geography", "difficulty": 1 },
  { "clue": "Frozen water", "answer": "Ice", "category": "Nature" }
]`;

const SAMPLE_CSV = `clue,answer,category,difficulty
Capital of France,Paris,Geography,1
Frozen water,Ice,Nature,2`;

type Result =
  | { ok: true; text: string }
  | { ok: false; text: string }
  | null;

export function ImportPanel({
  language,
  onDone,
}: {
  language: string;
  onDone: () => void;
}) {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [text, setText] = useState(SAMPLE_JSON);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const data = await orpc.admin.entries.import({
        languageCode: language,
        format,
        text,
        createMissingCategories: true,
      });
      setResult({
        ok: true,
        text: `Inserted ${data.inserted}, skipped ${data.skipped} duplicate(s), ${data.errors.length} error(s).`,
      });
      onDone();
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Import failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Paste JSON or CSV. Unknown categories are created automatically for{" "}
        <strong className="text-foreground">{language}</strong>. Duplicate
        clue/answer pairs are skipped.
      </p>

      <div className="space-y-1.5">
        <Label>Format</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={format}
          onValueChange={(v) => {
            if (!v) return;
            const f = v as "json" | "csv";
            setFormat(f);
            setText(f === "json" ? SAMPLE_JSON : SAMPLE_CSV);
          }}
        >
          <ToggleGroupItem value="json">JSON</ToggleGroupItem>
          <ToggleGroupItem value="csv">CSV</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Textarea
        className="h-64 font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />

      <Button onClick={run} disabled={busy}>
        {busy ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}
        {busy ? "Importing…" : "Import"}
      </Button>

      {result && (
        <Alert variant={result.ok ? "default" : "destructive"}>
          {result.ok ? <CircleCheckIcon /> : <TriangleAlertIcon />}
          <AlertTitle>{result.ok ? "Import complete" : "Import failed"}</AlertTitle>
          <AlertDescription>{result.text}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
