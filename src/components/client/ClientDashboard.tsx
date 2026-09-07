"use client";

import { useState } from "react";
import { PuzzleIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";

import type { PuzzleSummary } from "@/lib/puzzles";
import { orpc } from "@/lib/orpc/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Messages } from "@/lib/i18n";

/** The account itself — the signed-in address and signing out — is the
 *  header's user menu, so this page is only the puzzle listing. */
export function ClientDashboard({
  puzzles,
  messages,
}: {
  puzzles: PuzzleSummary[];
  messages: Messages["client"];
}) {
  const t = messages;
  // The listing is server-rendered; a deletion is reflected here rather than
  // by a round trip, so the card disappears as soon as the delete lands.
  const [deleted, setDeleted] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PuzzleSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = puzzles.filter((p) => !deleted.includes(p.slug));

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { slug } = pendingDelete;
    setPendingDelete(null);
    try {
      await orpc.client.puzzles.delete({ slug });
      setDeleted((prev) => [...prev, slug]);
      setError(null);
    } catch {
      setError(t.deleteFailed);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="bg-gradient-to-br from-foreground to-primary bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
          {t.dashboardTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{t.dashboardSubtitle}</p>
      </header>

      {error && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <Card className="border-border/60 border-dashed bg-card/60 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <PuzzleIcon className="size-5" />
            </span>
            <p>{t.empty}</p>
            <Button asChild size="sm">
              <a href="/public">{t.generateCta}</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((p) => (
            <Card
              key={p.slug}
              className="border-border/60 bg-card/60 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {p.languageCode}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={`/public/puzzles/${p.slug}`}>{t.continueSolving}</a>
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`${t.deletePuzzle}: ${p.title}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDelete(p)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.title} — {t.deleteConfirmBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t.deletePuzzle}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
