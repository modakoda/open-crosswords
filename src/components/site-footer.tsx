import { ArrowUpRightIcon, GridIcon, LinkIcon } from "lucide-react";

import { GithubIcon } from "@/components/icons";
import type { Messages } from "@/lib/i18n";

const REPO_URL = "https://github.com/open-crosswords/open-crosswords";
const AUTHOR_URL = "https://modakoda.com";

/**
 * Site chrome footer. Server component — no interactivity, and `no-print` keeps
 * it off printed puzzles.
 */
export function SiteFooter({
  messages,
  source,
  sourceAria,
}: {
  messages: Messages["footer"];
  /** Reused from the header dictionary so the GitHub label is translated once. */
  source: string;
  sourceAria: string;
}) {
  return (
    <footer className="no-print relative isolate mt-16 overflow-hidden border-t border-border/60">
      {/* Decorative: a lit hairline across the top edge and a soft glow behind
          the brand block. Both purely cosmetic, hidden from assistive tech. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                <GridIcon className="size-4" />
              </span>
              Open Crosswords
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {messages.tagline}
            </p>
          </div>

          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/70 py-2 pl-4 pr-3 shadow-sm backdrop-blur transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {messages.createdBy}
            </span>
            <span className="bg-gradient-to-r from-primary to-chart-5 bg-clip-text text-sm font-semibold text-transparent">
              modakoda.com
            </span>
            <ArrowUpRightIcon className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </a>
        </div>

        <div className="mt-8 flex flex-col items-start gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2">
            <LinkIcon className="size-3.5 shrink-0" aria-hidden />
            {messages.shareable}
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={sourceAria}
            className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <GithubIcon className="size-4" />
            {source}
          </a>
        </div>
      </div>
    </footer>
  );
}
