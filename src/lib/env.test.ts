import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

/**
 * `parseEnv` takes the environment it validates, so every case here states its
 * whole configuration rather than mutating the process. The module-level
 * `env` export runs the same function against `process.env` at import.
 */
const base = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789",
};

const production = { ...base, NODE_ENV: "production" };

describe("required values", () => {
  it("rejects a missing database connection string", () => {
    expect(() => parseEnv({ BETTER_AUTH_SECRET: base.BETTER_AUTH_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a secret too short to be worth having", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("reports every problem at once", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/);
  });

  it("names the variable without echoing its value", () => {
    // Messages reach logs and terminals; the values are secrets.
    expect(() => parseEnv({ ...base, DATABASE_URL: "not-a-url" })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("not-a-url") }),
    );
  });

  it("applies defaults for everything optional", () => {
    const env = parseEnv(base);
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(env.ADMIN_EMAILS).toEqual([]);
    expect(env.ANTHROPIC_API_KEY).toBe("");
    expect(env.NODE_ENV).toBe("development");
  });
});

describe("ADMIN_EMAILS", () => {
  it("splits, trims and lowercases the list", () => {
    const env = parseEnv({ ...base, ADMIN_EMAILS: " One@Example.com , two@example.com " });
    expect(env.ADMIN_EMAILS).toEqual(["one@example.com", "two@example.com"]);
  });
});

describe("AUTH_IP_HEADER", () => {
  it("refuses to boot a production server that has not stated a source", () => {
    // Failing closed matters: the default names Vercel's header, and believing
    // it anywhere else lets a caller send it and rotate past every rate limit.
    expect(() => parseEnv(production)).toThrow(/AUTH_IP_HEADER/);
  });

  it("accepts a production server that names its proxy's header", () => {
    expect(parseEnv({ ...production, AUTH_IP_HEADER: "X-Real-IP" }).AUTH_IP_HEADER).toBe(
      "x-real-ip",
    );
  });

  it('accepts "" as a deliberate statement that no header is trusted', () => {
    expect(parseEnv({ ...production, AUTH_IP_HEADER: "" }).AUTH_IP_HEADER).toBe("");
  });

  it("accepts trusted proxies instead of a header", () => {
    const env = parseEnv({ ...production, AUTH_TRUSTED_PROXIES: "10.0.0.0/8" });
    expect(env.AUTH_TRUSTED_PROXIES).toEqual(["10.0.0.0/8"]);
  });

  it("leaves the Vercel default alone on Vercel", () => {
    expect(parseEnv({ ...production, VERCEL: "1" }).AUTH_IP_HEADER).toBe(
      "x-vercel-forwarded-for",
    );
  });

  it("does not demand one during `next build`, which serves no requests", () => {
    const env = parseEnv({ ...production, NEXT_PHASE: "phase-production-build" });
    expect(env.AUTH_IP_HEADER).toBe("x-vercel-forwarded-for");
  });

  it("still demands one in a serving process that reports the build phase", () => {
    // NEXT_RUNTIME is set only in a process that answers requests, so a stray
    // NEXT_PHASE in a deployed environment can't switch the guard off.
    expect(() =>
      parseEnv({
        ...production,
        NEXT_PHASE: "phase-production-build",
        NEXT_RUNTIME: "nodejs",
      }),
    ).toThrow(/AUTH_IP_HEADER/);
  });

  it("does not demand one outside production", () => {
    expect(parseEnv({ ...base }).AUTH_IP_HEADER).toBe("x-vercel-forwarded-for");
  });

  it("refuses a header and trusted proxies together", () => {
    // With proxies configured the address comes from x-forwarded-for, so a
    // named header would be silently ignored rather than honoured.
    expect(() =>
      parseEnv({
        ...production,
        AUTH_IP_HEADER: "cf-connecting-ip",
        AUTH_TRUSTED_PROXIES: "10.0.0.1",
      }),
    ).toThrow(/not both/);
  });

  it('allows "" alongside trusted proxies, which names no header', () => {
    const env = parseEnv({
      ...production,
      AUTH_IP_HEADER: "",
      AUTH_TRUSTED_PROXIES: "10.0.0.1",
    });
    expect(env.AUTH_TRUSTED_PROXIES).toEqual(["10.0.0.1"]);
  });

  it("rejects a trusted-proxy entry that is not an address or range", () => {
    // better-auth drops malformed entries silently, which would collapse every
    // visitor into one shared bucket without saying so.
    expect(() => parseEnv({ ...production, AUTH_TRUSTED_PROXIES: "not-an-ip" })).toThrow(
      /AUTH_TRUSTED_PROXIES/,
    );
  });
});
