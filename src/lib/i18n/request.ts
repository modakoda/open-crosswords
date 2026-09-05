import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, resolveLocaleFromAcceptLanguage, type Locale } from "./locales";

/**
 * The UI locale for chrome not tied to a puzzle: the visitor's explicit choice
 * (persisted in the `locale` cookie by the language switcher) if set, otherwise
 * whatever their browser's `Accept-Language` header prefers.
 */
export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
  const fallback = resolveLocaleFromAcceptLanguage(hdrs.get("accept-language"));
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, fallback);
}
