"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [signOutFailed, setSignOutFailed] = useState(false);
  const t = messages;

  // better-auth's client resolves to `{ data, error }` rather than throwing,
  // so a rejected sign-out (its rate limit covers /sign-out too) would
  // otherwise land on the login page with the session cookie still live.
  async function handleSignOut() {
    const result = await signOut();
    if (result?.error) {
      setSignOutFailed(true);
      return;
    }
    router.push("/client/login");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="bg-gradient-to-br from-foreground to-primary bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
            {t.dashboardTitle}
          </h1>
          <p className="text-sm text-muted-foreground">{t.dashboardSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{email}</span>
          {signOutFailed && (
            <span role="alert" className="text-sm text-destructive">
              {t.errorGeneric}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
          >
            <LogOutIcon />
            {t.signOut}
          </Button>
        </div>
      </header>

      {puzzles.length === 0 ? (
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
          {puzzles.map((p) => (
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
