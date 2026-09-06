"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchIcon, TriangleAlertIcon } from "lucide-react";

import type { Language } from "./workspace";
import { PuzzleTable, type Puzzle } from "./PuzzleTable";
import { DEFAULT_PAGE_SIZE, TablePagination, lastPage } from "./TablePagination";
import { orpc } from "@/lib/orpc/client";
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

export function PuzzleManager({
  language,
  languages,
}: {
  language: string;
  languages: Language[];
}) {
  const [rows, setRows] = useState<Puzzle[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState(language);
  const [lastLanguage, setLastLanguage] = useState(language);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Follow the dashboard's working language the way the entry listing does —
  // realigned during render so no pass lists the language just left behind.
  if (lastLanguage !== language) {
    setLastLanguage(language);
    setFilter(language);
    setPage(0);
  }

  const load = useCallback(() => {
    orpc.admin.puzzles
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
        // end; step back rather than stranding the admin on a blank page.
        const last = lastPage(d.total ?? 0, pageSize);
        if (page > last) setPage(last);
      })
      .catch(() => setMsg("Failed to load puzzles"));
  }, [filter, q, page, pageSize]);

  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search title or link…"
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
      </div>

      {msg && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      <PuzzleTable rows={rows} q={q} onChanged={load} />

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        noun="puzzles"
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(0);
        }}
      />
    </div>
  );
}
