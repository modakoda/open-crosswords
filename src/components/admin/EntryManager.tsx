"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";

import type { Category } from "./AdminDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Entry {
  id: string;
  clue: string;
  answer: string;
  answerNormalized: string;
  difficulty: number;
  enabled: number;
  categoryId: string | null;
  timesUsed: number;
}

const DIFF_TONE = [
  "",
  "text-emerald-600 dark:text-emerald-400",
  "text-lime-600 dark:text-lime-400",
  "text-amber-600 dark:text-amber-400",
  "text-orange-600 dark:text-orange-400",
  "text-red-600 dark:text-red-400",
];

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
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);

  const [clue, setClue] = useState("");
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [categoryName, setCategoryName] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams({ languageCode: language, limit: "100" });
    if (q) params.set("q", q);
    fetch(`/api/admin/entries?${params}`)
      .then((r) => r.json())
      .then((d: { rows: Entry[]; total: number }) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setMsg("Failed to load entries"));
  }, [language, q]);

  useEffect(load, [load]);

  async function createEntry(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    let categoryId: string | undefined;
    if (categoryName.trim()) {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ languageCode: language, name: categoryName.trim() }),
      });
      if (res.ok) {
        categoryId = (await res.json()).category.id;
        onCategoriesChanged();
      }
    }
    const res = await fetch("/api/admin/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        languageCode: language,
        clue,
        answer,
        difficulty,
        categoryId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Could not create entry");
      return;
    }
    setClue("");
    setAnswer("");
    setCategoryName("");
    setAddOpen(false);
    load();
  }

  async function toggle(entry: Entry) {
    await fetch(`/api/admin/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: entry.enabled === 0 }),
    });
    load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await fetch(`/api/admin/entries/${pendingDelete.id}`, { method: "DELETE" });
    setPendingDelete(null);
    load();
  }

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "—";

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

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto">
              <PlusIcon />
              New entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New entry</DialogTitle>
              <DialogDescription>
                Added to the <strong>{language}</strong> library.
              </DialogDescription>
            </DialogHeader>
            <form id="add-entry" onSubmit={createEntry} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-clue">Clue</Label>
                <Input
                  id="e-clue"
                  value={clue}
                  onChange={(e) => setClue(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="e-answer">Answer</Label>
                  <Input
                    id="e-answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-cat">Category (optional)</Label>
                  <Input
                    id="e-cat"
                    list="cat-list"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                  />
                  <datalist id="cat-list">
                    {categories.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select
                  value={String(difficulty)}
                  onValueChange={(v) => setDifficulty(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Difficulty {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </form>
            <DialogFooter>
              <Button type="submit" form="add-entry">
                Add entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {msg && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Clue</TableHead>
              <TableHead>Answer</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-center">Diff</TableHead>
              <TableHead className="text-center">Used</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No entries {q ? "match your search" : "yet"}.
                </TableCell>
              </TableRow>
            )}
            {rows.map((e) => (
              <TableRow key={e.id} data-disabled={!e.enabled}>
                <TableCell className="max-w-sm whitespace-normal">
                  {e.clue}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {e.answerNormalized}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {catName(e.categoryId)}
                </TableCell>
                <TableCell
                  className={`text-center font-semibold tabular-nums ${DIFF_TONE[e.difficulty] ?? ""}`}
                >
                  {e.difficulty}
                </TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {e.timesUsed}
                </TableCell>
                <TableCell className="text-center">
                  {e.enabled ? (
                    <Badge variant="secondary">On</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Off
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toggle(e)}>
                        {e.enabled ? "Disable" : "Enable"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setPendingDelete(e)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.clue} — {pendingDelete?.answerNormalized}. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
