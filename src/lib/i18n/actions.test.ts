import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = { set: vi.fn() };

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

const { setLocale } = await import("./actions");

describe("setLocale", () => {
  beforeEach(() => cookieStore.set.mockClear());

  it("persists a supported locale under the locale cookie", async () => {
    await setLocale("lt");
    expect(cookieStore.set).toHaveBeenCalledWith(
      "locale",
      "lt",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
  });

  it("ignores an unsupported value rather than writing it", async () => {
    await setLocale("es");
    await setLocale("<script>alert(1)</script>");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
