import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The point of the hook is the import itself: loading src/lib/env.ts is what
 * parses and validates the configuration, so these cases assert that it
 * happens (or is skipped) rather than inspecting any value.
 */
async function runRegister() {
  const loaded = vi.fn();
  vi.doMock("@/lib/env", () => {
    loaded();
    return { env: {}, parseEnv: () => ({}), isAiEnabled: () => false };
  });
  vi.resetModules();
  const { register } = await import("./instrumentation");
  await register();
  return loaded;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/env");
  vi.resetModules();
});

describe("register", () => {
  it("validates the environment when a Node.js server starts", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    expect(await runRegister()).toHaveBeenCalled();
  });

  it("skips runtimes that do not serve this app's routes", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    expect(await runRegister()).not.toHaveBeenCalled();
  });
});
