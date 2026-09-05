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

/**
 * Picks the UI locale from the browser's `Accept-Language` header: the
 * highest-quality supported language it asks for, otherwise the default.
 * Entries are ranked by their `q` weight (defaulting to 1, per RFC 9110)
 * rather than trusting the header's own order.
 */
export function resolveLocaleFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return defaultLocale;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.split(";").map((piece) => piece.trim());
      const q = params
        .map((param) => /^q=(.*)$/i.exec(param)?.[1])
        .find((value) => value !== undefined);
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return {
        code: tag!.slice(0, 2).toLowerCase(),
        quality: Number.isNaN(quality) ? 0 : quality,
        index,
      };
    })
    .filter(({ code, quality }) => isLocale(code) && quality > 0)
    // Ties keep the header's own order, which is the client's stated preference.
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return (ranked[0]?.code as Locale | undefined) ?? defaultLocale;
}
