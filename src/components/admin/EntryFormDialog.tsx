"use client";

import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";

import type { Category } from "./AdminDashboard";
import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EntryFormDialog({
  open,
  onOpenChange,
  language,
  categories,
  onCreated,
  onCategoryCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
  categories: Category[];
  onCreated: () => void;
  onCategoryCreated: () => void;
}) {
  const [clue, setClue] = useState("");
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [categoryName, setCategoryName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function createEntry(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    let categoryId: string | undefined;
    if (categoryName.trim()) {
      try {
        const { category } = await orpc.admin.categories.create({
          languageCode: language,
          name: categoryName.trim(),
        });
        categoryId = category.id;
        onCategoryCreated();
      } catch {
        /* fall through — entry can still be created without a category */
      }
    }
    try {
      await orpc.admin.entries.create({ languageCode: language, clue, answer, difficulty, categoryId });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not create entry");
      return;
    }
    setClue("");
    setAnswer("");
    setCategoryName("");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Input id="e-clue" value={clue} onChange={(e) => setClue(e.target.value)} required />
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
            <Select value={String(difficulty)} onValueChange={(v) => setDifficulty(Number(v))}>
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
          {msg && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertDescription>{msg}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button type="submit" form="add-entry">
            Add entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
