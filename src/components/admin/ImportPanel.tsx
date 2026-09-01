"use client";

import { useState } from "react";

const SAMPLE_JSON = `[
  { "clue": "Capital of France", "answer": "Paris", "category": "Geography", "difficulty": 1 },
  { "clue": "Frozen water", "answer": "Ice", "category": "Nature" }
]`;

const SAMPLE_CSV = `clue,answer,category,difficulty
Capital of France,Paris,Geography,1
Frozen water,Ice,Nature,2`;

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
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/entries/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          languageCode: language,
          format,
          text,
          createMissingCategories: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error ?? "Import failed");
      } else {
        setResult(
          `Inserted ${data.inserted}, skipped ${data.skipped} (duplicates), errors ${data.errors.length}.`,
        );
        onDone();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Paste JSON or CSV. Unknown categories are created automatically for{" "}
        <strong>{language}</strong>. Duplicate clue/answer pairs are skipped.
      </p>
      <div className="flex gap-2">
        {(["json", "csv"] as const).map((f) => (
          <button
            key={f}
            className={`btn ${format === f ? "!bg-amber-200" : ""}`}
            onClick={() => {
              setFormat(f);
              setText(f === "json" ? SAMPLE_JSON : SAMPLE_CSV);
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      <textarea
        className="field h-64 w-full font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn" onClick={run} disabled={busy}>
        {busy ? "Importing…" : "Import"}
      </button>
      {result && <p className="text-sm">{result}</p>}
    </div>
  );
}
