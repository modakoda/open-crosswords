"use client";

import { useRef, useState } from "react";
import {
  CircleCheckIcon,
  FileUpIcon,
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
import {
  IMPORT_FILE_ACCEPT,
  ImportFileError,
  readImportFile,
} from "@/lib/import-file";
import { ImportChunkError, splitImportText } from "@/lib/import-chunks";

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
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const loadToken = useRef(0);

  async function loadFile(file: File) {
    const token = ++loadToken.current;
    setResult(null);
    try {
      const loaded = await readImportFile(file);
      // A slower earlier read must not overwrite a newer pick.
      if (token !== loadToken.current) return;
      setFormat(loaded.format);
      setText(loaded.text);
      setFileName(file.name);
    } catch (err) {
      if (token !== loadToken.current) return;
      setFileName(null);
      setResult({
        ok: false,
        text:
          err instanceof ImportFileError
            ? err.message
            : "Could not read that file",
      });
    }
  }

  async function run() {
    setBusy(true);
    setResult(null);
    setProgress(null);

    let chunks: string[];
    try {
      chunks = splitImportText(text, format);
    } catch (err) {
      setBusy(false);
      setResult({
        ok: false,
        text: err instanceof ImportChunkError ? err.message : "Could not read that input",
      });
      return;
    }

    const totals = { inserted: 0, skipped: 0, errors: 0 };
    let failure: string | null = null;

    for (let i = 0; i < chunks.length; i++) {
      if (chunks.length > 1) setProgress({ done: i, total: chunks.length });
      try {
        const data = await orpc.admin.entries.import({
          languageCode: language,
          format,
          text: chunks[i],
          createMissingCategories: true,
        });
        totals.inserted += data.inserted;
        totals.skipped += data.skipped;
        totals.errors += data.errors.length;
      } catch (err) {
        failure = err instanceof Error ? err.message : "Import failed";
        break;
      }
    }

    setProgress(null);
    setBusy(false);

    const tally = `Inserted ${totals.inserted}, skipped ${totals.skipped} duplicate(s), ${totals.errors} error(s).`;
    if (failure) {
      setResult({ ok: false, text: `${tally} Stopped early: ${failure}` });
    } else {
      setResult({ ok: true, text: tally });
    }
    if (totals.inserted > 0) onDone();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Paste JSON or CSV, or load it from a file. Large files are sent in
        batches automatically. Unknown categories are created automatically
        for{" "}
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
            setFileName(null);
          }}
        >
          <ToggleGroupItem value="json">JSON</ToggleGroupItem>
          <ToggleGroupItem value="csv">CSV</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-1.5">
        <Label>File</Label>
        <div className="flex items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept={IMPORT_FILE_ACCEPT}
            className="sr-only"
            aria-label="Choose a JSON or CSV file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Reset so picking the same file again still fires a change.
              e.target.value = "";
              if (file) void loadFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInput.current?.click()}
          >
            <FileUpIcon />
            Choose file
          </Button>
          <span className="truncate text-sm text-muted-foreground">
            {fileName ?? "No file chosen"}
          </span>
        </div>
      </div>

      <Textarea
        className="h-64 font-mono text-xs"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setFileName(null);
        }}
        spellCheck={false}
      />

      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={busy}>
          {busy ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}
          {busy ? "Importing…" : "Import"}
        </Button>
        {progress && (
          <span role="status" className="text-sm text-muted-foreground">
            Batch {progress.done + 1} of {progress.total}
          </span>
        )}
      </div>

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
