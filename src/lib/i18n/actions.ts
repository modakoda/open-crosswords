"use server";

import { cookies } from "next/headers";

import { isLocale, LOCALE_COOKIE } from "./locales";

/** Persists the visitor's explicit UI language choice for future requests. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
