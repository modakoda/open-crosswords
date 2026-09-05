"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GridIcon, MenuIcon, ShieldIcon, UserIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useSession } from "@/lib/auth-client";
import type { Locale, Messages } from "@/lib/i18n";

function isActive(pathname: string, href: string) {
  return pathname.startsWith(href);
}

export function SiteHeader({
  messages,
  locale,
  isAdmin,
}: {
  messages: Messages["header"];
  /** The chrome locale currently in effect, so the switcher can mark it. */
  locale: Locale;
  /** Server-resolved admin flag (session + ADMIN_EMAILS). Hides the admin link
   * for everyone else; the admin routes/procedures do the real gating. */
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const nav = [
    { href: "/public", label: messages.nav.generate, icon: GridIcon },
    session
      ? { href: "/client/dashboard", label: messages.nav.client, icon: UserIcon }
      : { href: "/client/login", label: messages.nav.signIn, icon: UserIcon },
    ...(isAdmin
      ? [{ href: "/admin/dashboard", label: messages.nav.admin, icon: ShieldIcon }]
      : []),
  ];

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      {/* Cosmetic: the same lit hairline the footer uses, mirrored on the
          header's lower edge so the page is bracketed by it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-primary to-chart-5 text-primary-foreground shadow-sm ring-1 ring-primary/25 transition-transform group-hover:scale-105">
            <GridIcon className="size-4" />
          </span>
          Open Crosswords
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <nav className="hidden items-center gap-1 sm:flex">
            {nav.map(({ href, label }) => (
              <Button
                key={href}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full text-muted-foreground",
                  isActive(pathname, href) &&
                    "bg-primary/10 text-foreground ring-1 ring-primary/20",
                )}
              >
                <Link href={href}>{label}</Link>
              </Button>
            ))}
          </nav>
          <LanguageSwitcher currentLocale={locale} ariaLabel={messages.language} />
          <ThemeToggle />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label={messages.menu}>
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>{messages.menu}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-2">
                {nav.map(({ href, label, icon: Icon }) => (
                  <Button
                    key={href}
                    asChild
                    variant="ghost"
                    className={cn(
                      "justify-start rounded-lg",
                      isActive(pathname, href) &&
                        "bg-primary/10 text-foreground ring-1 ring-primary/20",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    <Link href={href}>
                      <Icon className="text-muted-foreground" />
                      {label}
                    </Link>
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
