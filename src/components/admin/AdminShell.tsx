"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { orpc } from "@/lib/orpc/client";
import { LANGUAGE_CODE } from "@/lib/validation/schemas";
import { AdminLanguageBar } from "./AdminLanguageBar";
import { AdminNav } from "./AdminNav";
import { AdminWorkspaceProvider, type Category, type Language } from "./workspace";

/** Used only until the language list loads, or if the library has none yet. */
const FALLBACK_LANGUAGE = "en";

/**
 * Chrome shared by every admin view. The view itself is a route (`children`),
 * and the working language is a `?lang=` query param rather than component
 * state, so any admin screen can be linked to, bookmarked and reloaded.
 */
export function AdminShell({
  aiEnabled,
  children,
}: {
  aiEnabled: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Reject a junk `?lang=` the same way the procedures would, rather than
  // sending it to the server and rendering an error state.
  const parsed = LANGUAGE_CODE.safeParse(searchParams.get("lang") ?? "");
  const requested = parsed.success ? parsed.data : "";
  const known = languages.some((l) => l.code === requested);
  const language =
    requested && (known || languages.length === 0)
      ? requested
      : (languages[0]?.code ?? FALLBACK_LANGUAGE);

  useEffect(() => {
    orpc.languages.list().then((d) => setLanguages(d.languages)).catch(() => {});
  }, []);

  // Write the resolved language back so the address bar always describes what
  // is on screen — deferred until the list is known, or an unloaded page would
  // pin the URL to the fallback before the real default arrives.
  useEffect(() => {
    if (languages.length === 0 || language === requested) return;
    const next = new URLSearchParams(searchParams);
    next.set("lang", language);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [languages, language, requested, pathname, router, searchParams]);

  const reloadCategories = useCallback(() => {
    orpc.categories
      .list({ languageCode: language })
      .then((d) => setCategories(d.categories))
      .catch(() => setCategories([]));
  }, [language]);

  useEffect(reloadCategories, [reloadCategories]);

  const setLanguage = useCallback(
    (code: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("lang", code);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const workspace = useMemo(
    () => ({ languages, language, categories, reloadCategories, aiEnabled }),
    [languages, language, categories, reloadCategories, aiEnabled],
  );

  return (
    <div className="space-y-5">
      <AdminLanguageBar
        language={language}
        languages={languages}
        onLanguageChange={setLanguage}
        onLanguagesChanged={setLanguages}
      />
      <AdminNav language={language} />
      <AdminWorkspaceProvider value={workspace}>{children}</AdminWorkspaceProvider>
    </div>
  );
}
