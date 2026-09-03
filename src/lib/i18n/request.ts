import { headers } from "next/headers";
import { resolveLocaleFromAcceptLanguage, type Locale } from "./locales";

/** The UI locale implied by the visitor's browser (`Accept-Language`), for chrome not tied to a puzzle. */
export async function getRequestLocale(): Promise<Locale> {
  const hdrs = await headers();
  return resolveLocaleFromAcceptLanguage(hdrs.get("accept-language"));
}
