import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

// A real (in-process) database rather than a stub, so the block check the
// guard performs is the one that runs in production, expiry rule included.
vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const { db } = await import("@/db");
const { user } = await import("@/db/schema");
const { getAdmin, requireAdmin, getCurrentUser, requireUser, ForbiddenError } =
  await import("./auth-guard");

/** An account row for the id the mocked session claims. */
async function seedUser(
  id: string,
  email: string,
  block: { blocked?: boolean; blockedUntil?: Date | null } = {},
) {
  await db.insert(user).values({
    id,
    name: id,
    email,
    emailVerified: true,
    blocked: block.blocked ?? false,
    blockedUntil: block.blockedUntil ?? null,
  });
}

// vitest.config sets ADMIN_EMAILS=admin@example.com
beforeEach(async () => {
  getSession.mockReset();
  await db.delete(user);
});

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
    await seedUser("u1", "admin@example.com");
    getSession.mockResolvedValue({
      user: { id: "u1", email: "Admin@Example.com", emailVerified: true },
    });
    expect(await getAdmin()).toEqual({ id: "u1", email: "admin@example.com" });
  });

  /**
   * Blocking is never a way to remove an administrator — the admin screen
   * refuses to target one — but the guard must not depend on that holding: a
   * blocked account authorizes nothing, whatever else is true of it.
   */
  it("returns null when the account is blocked", async () => {
    await seedUser("u1", "admin@example.com", { blocked: true });
    getSession.mockResolvedValue({
      user: { id: "u1", email: "admin@example.com", emailVerified: true },
    });
    expect(await getAdmin()).toBeNull();
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
    await seedUser("u2", "client@example.com");
    getSession.mockResolvedValue({
      user: { id: "u2", email: "Client@Example.com", emailVerified: false },
    });
    expect(await getCurrentUser()).toEqual({ id: "u2", email: "client@example.com" });
  });

  /**
   * A session minted before the block landed must stop working. Sessions are
   * deleted when a block is applied, so this is the backstop for one already
   * in flight.
   */
  it("returns null when the account is blocked", async () => {
    await seedUser("u2", "client@example.com", { blocked: true });
    getSession.mockResolvedValue({
      user: { id: "u2", email: "client@example.com", emailVerified: false },
    });
    expect(await getCurrentUser()).toBeNull();
  });

  it("lets a lapsed timed block through", async () => {
    await seedUser("u2", "client@example.com", {
      blocked: true,
      blockedUntil: new Date(Date.now() - 60_000),
    });
    getSession.mockResolvedValue({
      user: { id: "u2", email: "client@example.com", emailVerified: false },
    });
    expect(await getCurrentUser()).not.toBeNull();
  });

  it("keeps refusing while a timed block still runs", async () => {
    await seedUser("u2", "client@example.com", {
      blocked: true,
      blockedUntil: new Date(Date.now() + 3_600_000),
    });
    getSession.mockResolvedValue({
      user: { id: "u2", email: "client@example.com", emailVerified: false },
    });
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("requireUser", () => {
  it("throws ForbiddenError when signed out", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("resolves for a signed-in client", async () => {
    await seedUser("u2", "client@example.com");
    getSession.mockResolvedValue({
      user: { id: "u2", email: "client@example.com", emailVerified: false },
    });
    expect(await requireUser()).toEqual({ id: "u2", email: "client@example.com" });
  });
});
