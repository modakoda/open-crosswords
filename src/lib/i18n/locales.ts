export const locales = ["en", "lt"] as const;
export type Locale = (typeof locales)[number];
const defaultLocale: Locale = "en";

/** Native display name for each supported UI locale, shown in the language switcher. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  lt: "Lietuvių",
};

/** Cookie the visitor's explicit locale choice is persisted under. */
export const LOCALE_COOKIE = "locale";

export function isLocale(code: unknown): code is Locale {
  return typeof code === "string" && (locales as readonly string[]).includes(code);
}

/** Resolves an arbitrary code (e.g. a puzzle's content language) to a supported UI locale. */
export function resolveLocale(
  code: string | null | undefined,
  fallback: Locale = defaultLocale,
): Locale {
  return isLocale(code) ? code : fallback;
}

/** Picks the first UI locale the browser's `Accept-Language` header prefers. */
export function resolveLocaleFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return defaultLocale;
  const preferred = header
    .split(",")
    .map((part) => part.split(";")[0]!.trim().slice(0, 2).toLowerCase());
  return preferred.find(isLocale) ?? defaultLocale;
}
