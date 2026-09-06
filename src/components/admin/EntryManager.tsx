"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";

import type { Category, Language } from "./AdminDashboard";
import { EntryFormDialog } from "./EntryFormDialog";
import { EntryTable, type Entry } from "./EntryTable";
import {
  DEFAULT_PAGE_SIZE,
  EntryPagination,
  lastPage,
} from "./EntryPagination";
import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Sentinel for "don't filter by language" — an empty Select value is invalid. */
const ALL = "__all__";

export function EntryManager({
  language,
  languages,
  categories,
  onCategoriesChanged,
}: {
  language: string;
  languages: Language[];
  categories: Category[];
  onCategoriesChanged: () => void;
}) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState(language);
  const [lastLanguage, setLastLanguage] = useState(language);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // The working language governs what gets created; the filter starts there but
  // can be widened to the whole library. Realigning it during render (rather
  // than in an effect) avoids a pass that lists the language just left behind.
  if (lastLanguage !== language) {
    setLastLanguage(language);
    setFilter(language);
    setPage(0);
  }

  const load = useCallback(() => {
    orpc.admin.entries
      .list({
        languageCode: filter === ALL ? undefined : filter,
        limit: pageSize,
        offset: page * pageSize,
        q: q || undefined,
      })
      .then((d) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
        // Deleting the last row of the last page leaves the offset past the
        // end; step back so the listing never strands the admin on a blank
        // page they have to page out of themselves.
        const last = lastPage(d.total ?? 0, pageSize);
        if (page > last) setPage(last);
      })
      .catch(() => setMsg("Failed to load entries"));
  }, [filter, q, page, pageSize]);

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
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => {
            setFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All languages</SelectItem>
            {languages.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name} ({l.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <EntryTable rows={rows} q={q} showLanguage={filter === ALL} onChanged={load} />

      <EntryPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(0);
        }}
      />
    </div>
  );
}
