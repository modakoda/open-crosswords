import { cookies, headers } from "next/headers";

import {
  LOCALE_COOKIE,
  resolveLocale,
  resolveLocaleFromAcceptLanguage,
  type Locale,
} from "./locales";

/**
 * The UI locale for every page: the visitor's explicit choice (persisted in the
 * `locale` cookie by the language switcher) if set, otherwise whatever their
 * browser's `Accept-Language` header prefers.
 *
 * It is deliberately the only source of the interface language, including on a
 * puzzle's solve and print pages. Those once read as the puzzle's own content
 * language, which left the header's switcher naming one language and the page
 * rendering another, with no way to pick the language already displayed.
 * Interface language is the visitor's; the puzzle's language stays a property
 * of its clues.
 *
 * Reading the cookie keeps every render request-dynamic, which the layout also
 * relies on for its viewer-dependent admin flag.
 */
export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
  const fallback = resolveLocaleFromAcceptLanguage(hdrs.get("accept-language"));
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, fallback);
}
