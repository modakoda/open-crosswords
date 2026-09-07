"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, TriangleAlertIcon } from "lucide-react";

import { LanguageTable, type LanguageRow } from "./LanguageTable";
import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The languages view: the library's content languages and what each one holds.
 * Adding one lives here rather than in the dashboard chrome — it is a rare,
 * library-shaping action, and the counts beside each row are what tell an
 * admin whether a code is real or a typo. Removing one is offered only while
 * those counts leave nothing to lose; the dashboard's working language is not
 * this screen's business, so nothing here switches it.
 */
export function LanguageManager({
  onLanguagesChanged,
}: {
  onLanguagesChanged: () => void;
}) {
  const [rows, setRows] = useState<LanguageRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    orpc.admin.languages
      .list()
      .then((d) => setRows(d.languages))
      .catch(() => setMsg("Failed to load languages"));
  }, []);

  useEffect(load, [load]);

  // The shell's picker reads the public list, so every mutation has to refresh
  // both: this table for the counts, and the workspace for the pickers.
  const refresh = useCallback(() => {
    load();
    onLanguagesChanged();
  }, [load, onLanguagesChanged]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const code = newCode.trim().toLowerCase();
    if (!code || adding) return;
    setAdding(true);
    setMsg(null);
    // Only the call itself is guarded: anything that goes wrong while
    // refreshing afterwards is not a failed add, and saying so would send the
    // admin back to retype a code the library already has.
    try {
      await orpc.admin.languages.create({
        code,
        name: newName.trim() || undefined,
      });
    } catch {
      setMsg("Could not add that language. Use a code like 'lt' or 'pt-br'.");
      return;
    } finally {
      setAdding(false);
    }
    setNewCode("");
    setNewName("");
    try {
      refresh();
    } catch {
      setMsg(`Added ${code}, but the screen could not be refreshed. Reload it.`);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a language</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-language-code">Code</Label>
              <Input
                id="new-language-code"
                className="w-28"
                placeholder="e.g. lt"
                value={newCode}
                onChange={(e) => {
                  setNewCode(e.target.value);
                  setMsg(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-language-name">Name (optional)</Label>
              <Input
                id="new-language-name"
                className="w-56"
                placeholder="e.g. Lietuvių"
                maxLength={80}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={adding || !newCode.trim()}>
              <PlusIcon />
              {adding ? "Adding..." : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {msg && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      <LanguageTable rows={rows} onChanged={refresh} onError={setMsg} />
    </div>
  );
}
