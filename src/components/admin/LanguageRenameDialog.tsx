"use client";

import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";

import type { LanguageRow } from "./LanguageTable";
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

export function LanguageRenameDialog({
  language,
  onClose,
  onRenamed,
}: {
  language: LanguageRow | null;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState("");
  // Seed the field from whichever row was just opened, without an effect that
  // would clobber what the admin has typed on every re-render.
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (language && language.code !== lastCode) {
    setLastCode(language.code);
    setName(language.name);
    setMsg(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!language) return;
    setMsg(null);
    try {
      await orpc.admin.languages.rename({ code: language.code, name: name.trim() });
      onRenamed();
      onClose();
    } catch {
      setMsg("Could not rename that language.");
    }
  }

  return (
    <Dialog open={language !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rename language</DialogTitle>
            <DialogDescription>
              Only the display name changes. The code ({language?.code}) is what
              entries and puzzles are filed under, so it stays as it is.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="language-name">Name</Label>
            <Input
              id="language-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
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
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
