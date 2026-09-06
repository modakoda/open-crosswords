import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tilt runs this script on every `tilt up`, so the one property that matters
 * beyond "it provisions an account" is that a second run leaves the existing
 * account exactly as it was.
 */

const signUpEmail = vi.hoisted(() => vi.fn(async () => ({})));
const existingUsers = vi.hoisted(() => ({ rows: [] as { emailVerified: boolean }[] }));
const updateSet = vi.hoisted(() => vi.fn());

vi.mock("./load-env", () => ({}));
vi.mock("better-auth", () => ({ betterAuth: () => ({ api: { signUpEmail } }) }));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: () => ({}) }));
vi.mock("../src/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => existingUsers.rows }) }),
    }),
    update: () => ({
      set: (values: unknown) => {
        updateSet(values);
        return { where: async () => undefined };
      },
    }),
  },
}));

// The real process.exit ends the process; the stub has to unwind the same way,
// or the script runs on past it and the second run looks like a first one.
async function run(email: string) {
  let exited = false;
  const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    if (exited) return undefined; // the script's own error handler, unwinding
    exited = true;
    throw new Error(`exit ${code}`);
  }) as never);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  process.argv = ["node", "create-admin.ts", email, "Admin", "local-dev-password"];
  await import("./create-admin");
  await vi.waitFor(() => expect(exit).toHaveBeenCalled());
  return exit.mock.calls[0][0];
}

describe("create-admin", () => {
  beforeEach(() => {
    vi.resetModules();
    existingUsers.rows = [];
    signUpEmail.mockClear();
    updateSet.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provisions the account and marks its email verified", async () => {
    expect(await run("admin@example.com")).toBe(0);
    expect(signUpEmail).toHaveBeenCalledWith({
      body: { email: "admin@example.com", name: "Admin", password: "local-dev-password" },
    });
    expect(updateSet).toHaveBeenCalledWith({ emailVerified: true });
  });

  it("leaves an existing admin untouched instead of resetting its password", async () => {
    existingUsers.rows = [{ emailVerified: true }];
    expect(await run("admin@example.com")).toBe(0);
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("fails rather than adopt an unverified account someone else signed up with", async () => {
    existingUsers.rows = [{ emailVerified: false }];
    expect(await run("admin@example.com")).toBe(1);
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });
});
