"use client";

import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";

import type { Puzzle } from "./PuzzleTable";
import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PuzzleRenameDialog({
  puzzle,
  onClose,
  onRenamed,
}: {
  puzzle: Puzzle | null;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const [title, setTitle] = useState("");
  // Seed the field from whichever row was just opened, without an effect that
  // would clobber what the admin has typed on every re-render.
  const [lastId, setLastId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (puzzle && puzzle.id !== lastId) {
    setLastId(puzzle.id);
    setTitle(puzzle.title);
    setMsg(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!puzzle) return;
    setMsg(null);
    try {
      await orpc.admin.puzzles.rename({ id: puzzle.id, title: title.trim() });
      onRenamed();
      onClose();
    } catch {
      setMsg("Could not rename that puzzle.");
    }
  }

  return (
    <Dialog open={puzzle !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rename puzzle</DialogTitle>
            <DialogDescription>
              The shared link ({puzzle?.slug}) stays the same.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="puzzle-title">Title</Label>
            <Input
              id="puzzle-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          {msg && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertDescription>{msg}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
