import { describe, expect, it, vi } from "vitest";

const headerStore = { get: vi.fn() };
const cookieStore = { get: vi.fn() };

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(headerStore),
  cookies: () => Promise.resolve(cookieStore),
}));

const { getRequestLocale } = await import("./request");

describe("getRequestLocale", () => {
  it("uses Lithuanian when the browser prefers it", async () => {
    cookieStore.get.mockReturnValue(undefined);
    headerStore.get.mockReturnValue("lt-LT,lt;q=0.9,en;q=0.8");
    expect(await getRequestLocale()).toBe("lt");
  });

  it("uses English when the browser prefers an unsupported language", async () => {
    cookieStore.get.mockReturnValue(undefined);
    headerStore.get.mockReturnValue("fr-FR,fr;q=0.9");
    expect(await getRequestLocale()).toBe("en");
  });

  it("defaults to en when the header is missing", async () => {
    cookieStore.get.mockReturnValue(undefined);
    headerStore.get.mockReturnValue(null);
    expect(await getRequestLocale()).toBe("en");
  });

  it("prefers the visitor's explicit cookie choice over the browser header", async () => {
    cookieStore.get.mockReturnValue({ value: "lt" });
    headerStore.get.mockReturnValue("en-US,en;q=0.9");
    expect(await getRequestLocale()).toBe("lt");
  });

  it("ignores an unsupported cookie value and falls back to the header", async () => {
    cookieStore.get.mockReturnValue({ value: "../../etc/passwd" });
    headerStore.get.mockReturnValue("lt-LT,lt;q=0.9");
    expect(await getRequestLocale()).toBe("lt");
  });
});
