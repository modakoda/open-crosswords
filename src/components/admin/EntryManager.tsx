"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";

import type { Category, Language } from "./workspace";
import { EntryFormDialog } from "./EntryFormDialog";
import { EntryTable, type Entry } from "./EntryTable";
import {
  DEFAULT_PAGE_SIZE,
  TablePagination,
  lastPage,
} from "./TablePagination";
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

/** Sentinel for "don't filter by this" — an empty Select value is invalid. */
const ALL = "__all__";

/**
 * The entries listing. It opens across every language — the working language
 * scopes what a *new* entry is created in, so pre-filtering the listing to it
 * would hide most of the library for no reason. Picking a language here
 * narrows the listing and moves the shell's `?lang=`, so the toolbar is the
 * only language control this view needs; "All languages" is a wider view of
 * the same listing and deliberately doesn't move it.
 */
export function EntryManager({
  language,
  languages,
  categories,
  onLanguageChange,
  onCategoriesChanged,
}: {
  language: string;
  languages: Language[];
  categories: Category[];
  onLanguageChange: (code: string) => void;
  onCategoriesChanged: () => void;
}) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Unfiltered by default: the working language is about creation, not about
  // what the admin came here to look at.
  const [spanLanguages, setSpanLanguages] = useState(true);
  const [category, setCategory] = useState(ALL);
  const [lastLanguage, setLastLanguage] = useState(language);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // The language can also move from outside this toolbar (the shell resolves
  // one once the library loads), and the categories of the language just left
  // don't exist in the new scope. Realigning during render rather than in an
  // effect avoids a pass that lists the language already gone. The span stays
  // as the admin left it — an outside change to what a new entry is created in
  // is not a reason to re-filter the listing they are reading.
  if (lastLanguage !== language) {
    setLastLanguage(language);
    setCategory(ALL);
    setPage(0);
  }

  // Categories are scoped to one language, so spanning every language leaves no
  // coherent set to offer at all.
  const categoryOptions = spanLanguages ? [] : categories;

  const load = useCallback(() => {
    orpc.admin.entries
      .list({
        languageCode: spanLanguages ? undefined : language,
        categoryId: category === ALL ? undefined : category,
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
  }, [spanLanguages, language, category, q, page, pageSize]);

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
          value={spanLanguages ? ALL : language}
          onValueChange={(v) => {
            setSpanLanguages(v === ALL);
            // The categories of the language just left don't exist in the new
            // scope, so the filter can't survive the switch.
            setCategory(ALL);
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
        {categoryOptions.length > 0 && (
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PlusIcon />
          New entry
        </Button>
        <EntryFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          language={language}
          languages={languages}
          categories={categories}
          entry={editing}
          onSaved={load}
          onCategoryCreated={onCategoriesChanged}
        />
      </div>

      {msg && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      <EntryTable
        rows={rows}
        q={q}
        onEdit={(entry) => {
          setEditing(entry);
          setFormOpen(true);
        }}
        onChanged={load}
      />

      <TablePagination
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
