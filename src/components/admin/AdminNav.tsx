"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, SparklesIcon, TableIcon, UploadIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const ADMIN_VIEWS = [
  { segment: "entries", label: "Entries", Icon: TableIcon },
  { segment: "puzzles", label: "Puzzles", Icon: GridIcon },
  { segment: "import", label: "Bulk import", Icon: UploadIcon },
  { segment: "ai", label: "AI draft", Icon: SparklesIcon },
] as const;

export const ADMIN_BASE_PATH = "/admin/dashboard";

/** The default view — `/admin/dashboard` redirects here. */
export const DEFAULT_ADMIN_VIEW = ADMIN_VIEWS[0].segment;

/**
 * Views are routes, not tab state, so these are links: each one is
 * bookmarkable, survives a reload, and answers the browser's back button. The
 * working language rides along in the query string so switching views keeps it.
 */
export function AdminNav({ language }: { language: string }) {
  const pathname = usePathname();
  const query = language ? `?lang=${encodeURIComponent(language)}` : "";

  return (
    <nav
      aria-label="Admin views"
      className="inline-flex w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground"
    >
      {ADMIN_VIEWS.map(({ segment, label, Icon }) => {
        const href = `${ADMIN_BASE_PATH}/${segment}`;
        const active = pathname === href;
        return (
          <Link
            key={segment}
            href={`${href}${query}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
              active &&
                "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30",
            )}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
