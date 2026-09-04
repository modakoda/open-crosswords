"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";

import type { Category } from "./AdminDashboard";
import { EntryFormDialog } from "./EntryFormDialog";
import { EntryTable, type Entry } from "./EntryTable";
import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    orpc.admin.entries
      .list({ languageCode: language, limit: 100, q: q || undefined })
      .then((d) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setMsg("Failed to load entries"));
  }, [language, q]);

  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search clue or answer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {total} entries
        </Badge>

        <Button className="ml-auto" onClick={() => setAddOpen(true)}>
          <PlusIcon />
          New entry
        </Button>
        <EntryFormDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          language={language}
          categories={categories}
          onCreated={load}
          onCategoryCreated={onCategoriesChanged}
        />
      </div>

      {msg && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      <EntryTable rows={rows} q={q} categories={categories} onChanged={load} />
    </div>
  );
}
