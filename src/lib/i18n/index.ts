import { en } from "./messages/en";
import { lt } from "./messages/lt";
import type { Locale } from "./locales";

export type { Locale } from "./locales";
export { locales, defaultLocale, resolveLocale, resolveLocaleFromAcceptLanguage } from "./locales";

export type Messages = typeof en;

const dictionaries: Record<Locale, Messages> = { en, lt };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}

/** Fills a `{placeholder}` message template, e.g. `messages.solve.meta`. */
export function formatMessage(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
