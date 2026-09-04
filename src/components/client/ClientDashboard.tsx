"use client";

import { LogOutIcon, PuzzleIcon } from "lucide-react";

import { signOut } from "@/lib/auth-client";
import type { PuzzleSummary } from "@/lib/puzzles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Messages } from "@/lib/i18n";

export function ClientDashboard({
  email,
  puzzles,
  messages,
}: {
  email: string;
  puzzles: PuzzleSummary[];
  messages: Messages["client"];
}) {
  const t = messages;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.dashboardTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.dashboardSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut().then(() => location.assign("/client/login"))}
          >
            <LogOutIcon />
            {t.signOut}
          </Button>
        </div>
      </header>

      {puzzles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <PuzzleIcon className="size-6" />
            <p>{t.empty}</p>
            <Button asChild size="sm">
              <a href="/public">{t.generateCta}</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {puzzles.map((p) => (
            <Card key={p.slug}>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {p.languageCode}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <a href={`/public/puzzles/${p.slug}`}>{t.continueSolving}</a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
