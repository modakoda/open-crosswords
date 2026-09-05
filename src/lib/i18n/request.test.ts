import { describe, expect, it, vi } from "vitest";

const cookieStore = { get: vi.fn() };
const headerStore = { get: vi.fn() };

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
  headers: () => Promise.resolve(headerStore),
}));

const { getRequestLocale } = await import("./request");

describe("getRequestLocale", () => {
  it("uses the locale cookie when it's set to a supported locale", async () => {
    cookieStore.get.mockReturnValue({ value: "lt" });
    headerStore.get.mockReturnValue("en");
    expect(await getRequestLocale()).toBe("lt");
  });

  it("falls back to Accept-Language when no cookie is set", async () => {
    cookieStore.get.mockReturnValue(undefined);
    headerStore.get.mockReturnValue("lt-LT,lt;q=0.9");
    expect(await getRequestLocale()).toBe("lt");
  });

  it("ignores an unsupported cookie value and falls back to Accept-Language", async () => {
    cookieStore.get.mockReturnValue({ value: "es" });
    headerStore.get.mockReturnValue("lt-LT,lt;q=0.9");
    expect(await getRequestLocale()).toBe("lt");
  });

  it("defaults to en when neither cookie nor header is usable", async () => {
    cookieStore.get.mockReturnValue(undefined);
    headerStore.get.mockReturnValue(null);
    expect(await getRequestLocale()).toBe("en");
  });
});
