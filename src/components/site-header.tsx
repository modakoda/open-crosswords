"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GithubIcon, GridIcon, MenuIcon, ShieldIcon } from "lucide-react";

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

const NAV = [
  { href: "/", label: "Generate", icon: GridIcon },
  { href: "/admin", label: "Admin", icon: ShieldIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          {NAV.map(({ href, label }) => (
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
              aria-label="Source on GitHub"
            >
              <GithubIcon />
            </a>
          </Button>
          <ThemeToggle />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Menu">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-2">
                {NAV.map(({ href, label, icon: Icon }) => (
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
                    Source
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
