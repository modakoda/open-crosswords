"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocaleFlag } from "@/components/flags";
import { setLocale } from "@/lib/i18n/actions";
import { locales, localeNames, type Locale } from "@/lib/i18n";

/**
 * Switches the UI chrome's language. The choice is persisted server-side in the
 * `locale` cookie by `setLocale`; `router.refresh()` then re-renders the server
 * components that read it via `getRequestLocale`.
 */
export function LanguageSwitcher({
  currentLocale,
  ariaLabel,
}: {
  currentLocale: Locale;
  ariaLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === currentLocale) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 rounded-full pl-1.5 pr-2 text-muted-foreground data-[state=open]:bg-primary/10 data-[state=open]:text-foreground"
          aria-label={`${ariaLabel}: ${localeNames[currentLocale]}`}
          disabled={pending}
        >
          <LocaleFlag locale={currentLocale} className={pending ? "opacity-50" : undefined} />
          <span className="text-xs font-semibold uppercase tracking-wider">{currentLocale}</span>
          <ChevronDownIcon className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {locales.map((locale) => {
          const active = locale === currentLocale;
          return (
            <DropdownMenuItem
              key={locale}
              onClick={() => choose(locale)}
              className="justify-between gap-3 data-[active=true]:bg-primary/10"
              data-active={active}
            >
              <span className="flex items-center gap-2.5">
                <LocaleFlag locale={locale} />
                {localeNames[locale]}
              </span>
              {active && <CheckIcon className="size-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
