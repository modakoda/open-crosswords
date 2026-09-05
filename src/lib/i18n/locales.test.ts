import { describe, expect, it } from "vitest";
import { resolveLocale, resolveLocaleFromAcceptLanguage } from "./locales";

describe("resolveLocale", () => {
  it("passes through a supported code", () => {
    expect(resolveLocale("lt")).toBe("lt");
  });

  it("falls back to the default locale for an unsupported code", () => {
    expect(resolveLocale("es")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });

  it("falls back to a given fallback instead of the default", () => {
    expect(resolveLocale("es", "lt")).toBe("lt");
  });
});

describe("resolveLocaleFromAcceptLanguage", () => {
  it("picks the highest-quality supported language in the header", () => {
    expect(resolveLocaleFromAcceptLanguage("fr-FR,fr;q=0.9,lt;q=0.8,en;q=0.7")).toBe("lt");
  });

  it("ranks by q weight rather than header order", () => {
    expect(resolveLocaleFromAcceptLanguage("en;q=0.5,lt;q=0.9")).toBe("lt");
  });

  it("treats a weightless entry as q=1", () => {
    expect(resolveLocaleFromAcceptLanguage("en,lt;q=0.9")).toBe("en");
  });

  it("keeps header order for equal weights", () => {
    expect(resolveLocaleFromAcceptLanguage("lt,en")).toBe("lt");
  });

  it("ignores an explicitly refused language (q=0)", () => {
    expect(resolveLocaleFromAcceptLanguage("lt;q=0,en;q=0.5")).toBe("en");
  });

  it("defaults to en when nothing supported is listed", () => {
    expect(resolveLocaleFromAcceptLanguage("fr-FR,es;q=0.9")).toBe("en");
  });

  it("defaults to en when the header is missing", () => {
    expect(resolveLocaleFromAcceptLanguage(null)).toBe("en");
    expect(resolveLocaleFromAcceptLanguage(undefined)).toBe("en");
  });
});
