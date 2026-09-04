import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { getAdmin, requireAdmin, getCurrentUser, requireUser, ForbiddenError } =
  await import("./auth-guard");

// vitest.config sets ADMIN_EMAILS=admin@example.com
beforeEach(() => getSession.mockReset());

describe("getAdmin", () => {
  it("returns null with no session", async () => {
    getSession.mockResolvedValue(null);
    expect(await getAdmin()).toBeNull();
  });

  it("returns null when the email is not allow-listed", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", email: "someone@else.com", emailVerified: true },
    });
    expect(await getAdmin()).toBeNull();
  });

  it("returns null when the allow-listed email is not verified (fail closed)", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", email: "admin@example.com", emailVerified: false },
    });
    expect(await getAdmin()).toBeNull();
  });

  it("returns the admin for a verified, allow-listed session (case-insensitive)", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", email: "Admin@Example.com", emailVerified: true },
    });
    expect(await getAdmin()).toEqual({ id: "u1", email: "admin@example.com" });
  });
});

describe("requireAdmin", () => {
  it("throws ForbiddenError when not an admin", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("getCurrentUser", () => {
  it("returns null with no session", async () => {
    getSession.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns any signed-in user, unverified and not allow-listed", async () => {
    getSession.mockResolvedValue({
      user: { id: "u2", email: "Client@Example.com", emailVerified: false },
    });
    expect(await getCurrentUser()).toEqual({ id: "u2", email: "client@example.com" });
  });
});

describe("requireUser", () => {
  it("throws ForbiddenError when signed out", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("resolves for a signed-in client", async () => {
    getSession.mockResolvedValue({
      user: { id: "u2", email: "client@example.com", emailVerified: false },
    });
    expect(await requireUser()).toEqual({ id: "u2", email: "client@example.com" });
  });
});
