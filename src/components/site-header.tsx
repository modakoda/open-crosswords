"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GridIcon, MenuIcon, ShieldIcon, UserIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.43-2.7 5.41-5.27 5.69.42.36.78 1.08.78 2.18 0 1.57-.02 2.84-.02 3.23 0 .31.21.67.8.56C20.21 21.37 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function SiteHeader({
  messages,
  locale,
}: {
  messages: Messages["header"];
  locale: Locale;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const nav = [
    { href: "/public", label: messages.nav.generate, icon: GridIcon },
    session
      ? { href: "/client/dashboard", label: messages.nav.client, icon: UserIcon }
      : { href: "/client/login", label: messages.nav.signIn, icon: UserIcon },
    { href: "/admin/dashboard", label: messages.nav.admin, icon: ShieldIcon },
  ];

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <GridIcon className="size-4" />
          </span>
          Open Crosswords
        </Link>

        <nav className="ml-4 hidden items-center gap-1 sm:flex">
          {nav.map(({ href, label }) => (
            <Button
              key={href}
              asChild
              variant="ghost"
              size="sm"
              className={cn(
                "text-muted-foreground",
                isActive(pathname, href) && "bg-accent text-accent-foreground",
              )}
            >
              <Link href={href}>{label}</Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
            <a
              href="https://github.com/open-crosswords/open-crosswords"
              target="_blank"
              rel="noreferrer"
              aria-label={messages.sourceAria}
            >
              <GithubIcon />
            </a>
          </Button>
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
                      "justify-start",
                      isActive(pathname, href) && "bg-accent text-accent-foreground",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    <Link href={href}>
                      <Icon className="text-muted-foreground" />
                      {label}
                    </Link>
                  </Button>
                ))}
                <Separator className="my-2" />
                <Button asChild variant="ghost" className="justify-start">
                  <a
                    href="https://github.com/open-crosswords/open-crosswords"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <GithubIcon className="text-muted-foreground" />
                    {messages.source}
                  </a>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
