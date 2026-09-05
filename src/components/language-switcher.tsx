"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LanguagesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/lib/i18n/actions";
import { locales, localeNames, type Locale } from "@/lib/i18n";

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
        <Button variant="ghost" size="icon" aria-label={ariaLabel} disabled={pending}>
          <LanguagesIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => choose(locale)}
            data-active={locale === currentLocale}
            className="data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
          >
            {localeNames[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
