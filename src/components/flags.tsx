"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";
import { localeNames, type Locale } from "@/lib/i18n";

/**
 * Square flag marks for the supported UI locales, drawn in a 24×24 viewBox so
 * every locale's chip is the same shape (real flags are 1:2 / 3:5, which would
 * otherwise letterbox). Client-only: the Union Jack needs a `useId` clip path.
 */
type FlagProps = React.SVGProps<SVGSVGElement>;

/** Union Jack — stands in for the English UI locale. */
function UnionJackFlag(props: FlagProps) {
  const clip = useId();
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <clipPath id={clip}>
        {/* Alternating quadrants, so the red saltire is counterchanged. */}
        <path d="M12,12 h12 v12 z v12 h-12 z h-12 v-12 z v-12 h12 z" />
      </clipPath>
      <path fill="#012169" d="M0 0h24v24H0z" />
      <path stroke="#fff" strokeWidth="4.8" d="M0,0 L24,24 M24,0 L0,24" />
      <path
        stroke="#c8102e"
        strokeWidth="3.2"
        clipPath={`url(#${clip})`}
        d="M0,0 L24,24 M24,0 L0,24"
      />
      <path stroke="#fff" strokeWidth="8" d="M12,0 v24 M0,12 h24" />
      <path stroke="#c8102e" strokeWidth="4.8" d="M12,0 v24 M0,12 h24" />
    </svg>
  );
}

/** Lithuanian tricolour — yellow / green / red. */
function LithuaniaFlag(props: FlagProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="#fdb913" d="M0 0h24v8H0z" />
      <path fill="#006a44" d="M0 8h24v8H0z" />
      <path fill="#c1272d" d="M0 16h24v8H0z" />
    </svg>
  );
}

const flags: Record<Locale, (props: FlagProps) => React.JSX.Element> = {
  en: UnionJackFlag,
  lt: LithuaniaFlag,
};

/**
 * A locale's flag as a round chip. Decorative — the language name or code next
 * to it carries the meaning, so the flag itself stays out of the a11y tree.
 */
export function LocaleFlag({ locale, className }: { locale: Locale; className?: string }) {
  const Flag = flags[locale];
  return (
    <span
      aria-hidden
      title={localeNames[locale]}
      className={cn(
        "inline-grid size-5 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-black/15 dark:ring-white/20",
        className,
      )}
    >
      <Flag className="size-full" />
    </span>
  );
}
