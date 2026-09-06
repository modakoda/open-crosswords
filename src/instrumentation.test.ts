import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The hook's job is to make a bad configuration stop the boot, so these cases
 * assert on whether it validates at all — the rules themselves are covered in
 * src/lib/env/server.test.ts.
 */
async function runRegister() {
  const parseEnv = vi.fn();
  vi.doMock("@/lib/env/server", () => ({ parseEnv }));
  vi.resetModules();
  const { register } = await import("./instrumentation");
  register();
  return parseEnv;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/env/server");
  vi.resetModules();
});

describe("register", () => {
  it("validates the environment when a Node.js server starts", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    expect(await runRegister()).toHaveBeenCalledWith(process.env);
  });

  it("skips runtimes that do not serve this app's routes", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    expect(await runRegister()).not.toHaveBeenCalled();
  });

  it("propagates the failure so the server does not come up", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.doMock("@/lib/env/server", () => ({
      parseEnv: () => {
        throw new Error("Invalid environment configuration:\n  - DATABASE_URL: bad");
      },
    }));
    vi.resetModules();
    const { register } = await import("./instrumentation");
    expect(() => register()).toThrow(/Invalid environment configuration/);
  });
});
