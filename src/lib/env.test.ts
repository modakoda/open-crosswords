import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `src/lib/env.ts` decides at import time and throws, so each case re-imports
 * it against a stubbed environment. Vitest's own `test.env` supplies the
 * always-required values (see vitest.config.ts); only what a case is about is
 * stubbed here.
 */
async function loadEnv(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }
  return import("./env");
}

const production = {
  NODE_ENV: "production",
  VERCEL: undefined,
  NEXT_PHASE: undefined,
  AUTH_IP_HEADER: undefined,
  AUTH_TRUSTED_PROXIES: undefined,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("AUTH_IP_HEADER", () => {
  it("refuses to boot a production server that has not stated a source", async () => {
    // Failing closed matters: the default names Vercel's header, and believing
    // it anywhere else lets a caller send it and rotate past every rate limit.
    await expect(loadEnv(production)).rejects.toThrow(/AUTH_IP_HEADER/);
  });

  it("accepts a production server that names its proxy's header", async () => {
    const { env } = await loadEnv({
      ...production,
      AUTH_IP_HEADER: "X-Real-IP",
    });
    expect(env.AUTH_IP_HEADER).toBe("x-real-ip");
  });

  it('accepts "" as a deliberate statement that no header is trusted', async () => {
    const { env } = await loadEnv({ ...production, AUTH_IP_HEADER: "" });
    expect(env.AUTH_IP_HEADER).toBe("");
  });

  it("accepts trusted proxies instead of a header", async () => {
    const { env } = await loadEnv({
      ...production,
      AUTH_TRUSTED_PROXIES: "10.0.0.0/8",
    });
    expect(env.AUTH_TRUSTED_PROXIES).toEqual(["10.0.0.0/8"]);
  });

  it("leaves the Vercel default alone on Vercel", async () => {
    const { env } = await loadEnv({ ...production, VERCEL: "1" });
    expect(env.AUTH_IP_HEADER).toBe("x-vercel-forwarded-for");
  });

  it("does not demand one during `next build`, which serves no requests", async () => {
    const { env } = await loadEnv({
      ...production,
      NEXT_PHASE: "phase-production-build",
    });
    expect(env.AUTH_IP_HEADER).toBe("x-vercel-forwarded-for");
  });

  it("does not demand one outside production", async () => {
    const { env } = await loadEnv({ ...production, NODE_ENV: "development" });
    expect(env.AUTH_IP_HEADER).toBe("x-vercel-forwarded-for");
  });

  it("refuses a header and trusted proxies together", async () => {
    // With proxies configured the address comes from x-forwarded-for, so a
    // named header would be silently ignored rather than honoured.
    await expect(
      loadEnv({
        ...production,
        AUTH_IP_HEADER: "cf-connecting-ip",
        AUTH_TRUSTED_PROXIES: "10.0.0.1",
      }),
    ).rejects.toThrow(/not both/);
  });

  it("rejects a trusted-proxy entry that is not an address or range", async () => {
    // better-auth drops malformed entries silently, which would collapse every
    // visitor into one shared bucket without saying so.
    await expect(
      loadEnv({ ...production, AUTH_TRUSTED_PROXIES: "not-an-ip" }),
    ).rejects.toThrow(/AUTH_TRUSTED_PROXIES/);
  });
});
