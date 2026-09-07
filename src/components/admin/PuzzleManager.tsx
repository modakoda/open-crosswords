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

/**
 * The library-wide puzzle listing. As on the entries view it opens across every
 * language, and its language filter *is* the dashboard's working language, so
 * this is the only language control the view needs.
 */
export function PuzzleManager({
  language,
  languages,
  onLanguageChange,
}: {
  language: string;
  languages: Language[];
  onLanguageChange: (code: string) => void;
}) {
  const [rows, setRows] = useState<Puzzle[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  // Unfiltered by default — see `EntryManager`.
  const [spanLanguages, setSpanLanguages] = useState(true);
  const [lastLanguage, setLastLanguage] = useState(language);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // The language can also move from outside this toolbar (the shell resolves
  // one once the library loads) — realigned during render so no pass lists the
  // language left behind. The span stays as the admin left it.
  if (lastLanguage !== language) {
    setLastLanguage(language);
    setPage(0);
  }

  const load = useCallback(() => {
    orpc.admin.puzzles
      .list({
        languageCode: spanLanguages ? undefined : language,
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
  }, [spanLanguages, language, q, page, pageSize]);

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
          value={spanLanguages ? ALL : language}
          onValueChange={(v) => {
            setSpanLanguages(v === ALL);
            setPage(0);
            if (v !== ALL && v !== language) onLanguageChange(v);
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
