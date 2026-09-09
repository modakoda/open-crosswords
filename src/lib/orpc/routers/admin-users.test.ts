import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { call, ORPCError } from "@orpc/server";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const adminState = { allow: true };
vi.mock("@/lib/auth-guard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-guard")>("@/lib/auth-guard");
  return {
    ...actual,
    requireAdmin: vi.fn(async () => {
      if (!adminState.allow) throw new actual.ForbiddenError("no");
      return { id: "admin-self", email: "admin@example.com" };
    }),
  };
});

const { db } = await import("@/db");
const { languages, puzzles, session, signInAttempt, solveStates, user } =
  await import("@/db/schema");
const { adminUsersRouter } = await import("./admin-users");
const { attemptKey, PER_ACCOUNT } = await import("@/lib/auth-throttle");

const ctx = () => ({ context: { headers: new Headers() } });

/** `vitest.config.ts` pins ADMIN_EMAILS to this one address. */
const ADMIN_EMAIL = "admin@example.com";

async function seedUser(
  id: string,
  over: Partial<{
    email: string;
    name: string;
    emailVerified: boolean;
    createdAt: Date;
    blocked: boolean;
    blockedUntil: Date | null;
  }> = {},
) {
  await db.insert(user).values({
    id,
    name: over.name ?? `User ${id}`,
    email: over.email ?? `${id}@example.com`,
    emailVerified: over.emailVerified ?? true,
    blocked: over.blocked ?? false,
    blockedUntil: over.blockedUntil ?? null,
    ...(over.createdAt ? { createdAt: over.createdAt } : {}),
  });
  return id;
}

/** A run of failed attempts against the account-wide counter for `email`. */
async function seedAccountLock(email: string, failedCount: number, at = new Date()) {
  await db.insert(signInAttempt).values({
    identifier: attemptKey("account", email),
    failedCount,
    lastFailedAt: at,
  });
}

async function seedSession(id: string, userId: string, expiresAt: Date) {
  await db.insert(session).values({
    id,
    token: `token-${id}`,
    userId,
    expiresAt,
  });
}

async function seedPuzzle(slug: string, userId: string | null) {
  const [row] = await db
    .insert(puzzles)
    .values({
      slug,
      title: `Puzzle ${slug}`,
      languageCode: "en",
      userId,
      paperSize: "a4",
      orientation: "portrait",
      width: 15,
      height: 15,
      seed: "seed",
      placements: [],
      grid: [],
    })
    .returning({ id: puzzles.id });
  return row.id;
}

const hour = (n: number) => new Date(Date.now() + n * 3600_000);

beforeEach(async () => {
  adminState.allow = true;
  await db.execute(
    sql`truncate ${puzzles}, ${solveStates}, ${session}, ${signInAttempt}, ${languages}, ${user} restart identity cascade`,
  );
  await db.insert(languages).values([{ code: "en", name: "English" }]);
});

describe("admin.users.list", () => {
  it("refuses a caller who is not an admin", async () => {
    adminState.allow = false;
    await expect(call(adminUsersRouter.list, {}, ctx())).rejects.toThrow(ORPCError);
  });

  it("lists accounts newest first with their totals", async () => {
    await seedUser("older", { createdAt: new Date("2024-01-01") });
    await seedUser("newer", { createdAt: new Date("2025-01-01") });
    await seedPuzzle("p1", "newer");
    await seedPuzzle("p2", "newer");
    await seedPuzzle("p3", null);
    const puzzleId = await seedPuzzle("p4", "older");
    await db.insert(solveStates).values({ puzzleId, userId: "newer", progress: {} });
    await seedSession("live", "newer", hour(1));
    await seedSession("dead", "newer", hour(-1));

    const res = await call(adminUsersRouter.list, {}, ctx());

    expect(res.total).toBe(2);
    expect(res.rows.map((r) => r.id)).toEqual(["newer", "older"]);
    const [newer] = res.rows;
    expect(newer.puzzleCount).toBe(2);
    expect(newer.solveCount).toBe(1);
    // The expired session must not count as a device that can act right now.
    expect(newer.activeSessions).toBe(1);
  });

  it("never carries a password or any other credential field", async () => {
    await seedUser("u1");
    const [row] = (await call(adminUsersRouter.list, {}, ctx())).rows;
    expect(Object.keys(row).sort()).toEqual([
      "activeSessions",
      "blocked",
      "blockedAt",
      "blockedReason",
      "blockedUntil",
      "createdAt",
      "email",
      "emailVerified",
      "holdsAdminAddress",
      "id",
      "isAdmin",
      "name",
      "puzzleCount",
      "signInLockSeconds",
      "solveCount",
    ]);
  });

  it("reports admin-ness from the allow-list, and only once the email is verified", async () => {
    await seedUser("the-admin", { email: ADMIN_EMAIL });
    await seedUser("pending", { email: "ADMIN@EXAMPLE.COM".replace("ADMIN", "admin2") });
    await seedUser("client", { email: "client@example.com" });

    const rows = (await call(adminUsersRouter.list, {}, ctx())).rows;
    const by = (id: string) => rows.find((r) => r.id === id)!;
    expect(by("the-admin")).toMatchObject({ isAdmin: true, holdsAdminAddress: false });
    expect(by("client")).toMatchObject({ isAdmin: false, holdsAdminAddress: false });

    // Same address, email not verified: allow-listed but no access yet.
    await db.delete(user).where(sql`${user.id} = 'the-admin'`);
    await seedUser("unverified-admin", { email: ADMIN_EMAIL, emailVerified: false });
    const again = (await call(adminUsersRouter.list, {}, ctx())).rows;
    expect(again.find((r) => r.id === "unverified-admin")).toMatchObject({
      isAdmin: false,
      holdsAdminAddress: true,
    });
  });

  it("searches name and email, treating LIKE metacharacters literally", async () => {
    await seedUser("a", { name: "Ada Lovelace", email: "ada@example.com" });
    await seedUser("b", { name: "Bob", email: "bob@example.com" });
    await seedUser("c", { name: "100% Real", email: "pct@example.com" });

    expect((await call(adminUsersRouter.list, { q: "ada" }, ctx())).total).toBe(1);
    expect((await call(adminUsersRouter.list, { q: "LOVELACE" }, ctx())).total).toBe(1);
    // A bare `%` must match the literal character, not every row.
    expect((await call(adminUsersRouter.list, { q: "100%" }, ctx())).total).toBe(1);
    expect((await call(adminUsersRouter.list, { q: "_" }, ctx())).total).toBe(0);
  });

  it("filters by verification and paginates", async () => {
    await seedUser("v1");
    await seedUser("v2");
    await seedUser("u1", { emailVerified: false });

    expect((await call(adminUsersRouter.list, { verified: true }, ctx())).total).toBe(2);
    expect((await call(adminUsersRouter.list, { verified: false }, ctx())).total).toBe(1);

    const page = await call(adminUsersRouter.list, { limit: 2, offset: 2 }, ctx());
    expect(page.total).toBe(3);
    expect(page.rows).toHaveLength(1);
  });
});

describe("admin.users.delete", () => {
  it("refuses a caller who is not an admin", async () => {
    adminState.allow = false;
    await expect(
      call(adminUsersRouter.delete, { id: "whoever" }, ctx()),
    ).rejects.toThrow(ORPCError);
  });

  it("removes the account and its sessions and solve progress", async () => {
    await seedUser("victim");
    await seedSession("s1", "victim", hour(1));
    const puzzleId = await seedPuzzle("p1", "victim");
    await db.insert(solveStates).values({ puzzleId, userId: "victim", progress: {} });

    const res = await call(adminUsersRouter.delete, { id: "victim" }, ctx());
    expect(res).toMatchObject({ deleted: true, email: "victim@example.com" });

    expect(await db.select().from(user)).toHaveLength(0);
    expect(await db.select().from(session)).toHaveLength(0);
    expect(await db.select().from(solveStates)).toHaveLength(0);
  });

  it("keeps the puzzles they generated, as anonymous ones", async () => {
    await seedUser("author");
    await seedPuzzle("kept", "author");

    await call(adminUsersRouter.delete, { id: "author" }, ctx());

    const [row] = await db.select().from(puzzles);
    expect(row.slug).toBe("kept");
    expect(row.userId).toBeNull();
  });

  it("refuses to delete an admin — allow-listed and verified", async () => {
    await seedUser("other-admin", { email: ADMIN_EMAIL });
    await expect(
      call(adminUsersRouter.delete, { id: "other-admin" }, ctx()),
    ).rejects.toThrow(/out-of-band/);
    expect(await db.select().from(user)).toHaveLength(1);
  });

  /**
   * The mirror of the case above, and the reason the guard tests both halves.
   * `npm run create-admin` verifies in the same run and refuses an address an
   * unverified account already holds, so this row is a public sign-up
   * squatting an allow-listed address: no admin access, and it blocks that
   * address from ever being provisioned. Shielding it would make the block
   * permanent, so it must stay removable.
   */
  it("deletes an unverified account squatting an allow-listed address", async () => {
    await seedUser("squatter", { email: ADMIN_EMAIL, emailVerified: false });
    await expect(
      call(adminUsersRouter.delete, { id: "squatter" }, ctx()),
    ).resolves.toMatchObject({ deleted: true });
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it("refuses to delete the calling admin's own account", async () => {
    await seedUser("admin-self", { email: "someone-else@example.com" });
    await expect(
      call(adminUsersRouter.delete, { id: "admin-self" }, ctx()),
    ).rejects.toThrow(/your own account/);
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it("404s on an unknown id", async () => {
    await expect(
      call(adminUsersRouter.delete, { id: "ghost" }, ctx()),
    ).rejects.toThrow(/not found/i);
  });
});

describe("admin.users.revokeSessions", () => {
  it("refuses a caller who is not an admin", async () => {
    adminState.allow = false;
    await expect(
      call(adminUsersRouter.revokeSessions, { id: "whoever" }, ctx()),
    ).rejects.toThrow(ORPCError);
  });

  it("drops every session of that user and nobody else's", async () => {
    await seedUser("target");
    await seedUser("bystander");
    await seedSession("t1", "target", hour(1));
    await seedSession("t2", "target", hour(-1));
    await seedSession("b1", "bystander", hour(1));

    const res = await call(adminUsersRouter.revokeSessions, { id: "target" }, ctx());
    expect(res.revoked).toBe(2);

    const left = await db.select({ id: session.id }).from(session);
    expect(left).toEqual([{ id: "b1" }]);
    // The account itself survives — this signs out, it doesn't remove.
    expect(await db.select().from(user)).toHaveLength(2);
  });

  it("refuses to touch a verified admin account or the caller's own", async () => {
    await seedUser("other-admin", { email: ADMIN_EMAIL });
    await seedUser("admin-self", { email: "someone-else@example.com" });
    await seedSession("a1", "other-admin", hour(1));
    await seedSession("a2", "admin-self", hour(1));

    await expect(
      call(adminUsersRouter.revokeSessions, { id: "other-admin" }, ctx()),
    ).rejects.toThrow(/out-of-band/);
    await expect(
      call(adminUsersRouter.revokeSessions, { id: "admin-self" }, ctx()),
    ).rejects.toThrow(/your own account/);

    expect(await db.select().from(session)).toHaveLength(2);
  });
});

describe("admin.users.block", () => {
  it("refuses a caller who is not an admin", async () => {
    adminState.allow = false;
    await expect(
      call(adminUsersRouter.block, { id: "whoever" }, ctx()),
    ).rejects.toThrow(ORPCError);
  });

  it("blocks indefinitely and ends every session", async () => {
    await seedUser("spammer");
    await seedSession("s1", "spammer", hour(1));
    await seedSession("s2", "spammer", hour(5));

    const res = await call(
      adminUsersRouter.block,
      { id: "spammer", reason: "Spam" },
      ctx(),
    );
    expect(res).toMatchObject({ blockedUntil: null, revokedSessions: 2 });

    const [row] = await db.select().from(user);
    expect(row.blocked).toBe(true);
    expect(row.blockedReason).toBe("Spam");
    expect(row.blockedUntil).toBeNull();
    expect(row.blockedAt).not.toBeNull();
    expect(await db.select().from(session)).toHaveLength(0);
  });

  it("turns a duration in days into an absolute expiry", async () => {
    await seedUser("temp");
    const before = Date.now();

    const res = await call(adminUsersRouter.block, { id: "temp", days: 7 }, ctx());

    const until = new Date(res.blockedUntil!).getTime();
    expect(until).toBeGreaterThanOrEqual(before + 7 * 86_400_000);
    expect(until).toBeLessThan(Date.now() + 7 * 86_400_000 + 5_000);
  });

  it("rejects a duration outside the allowed range", async () => {
    await seedUser("temp");
    await expect(
      call(adminUsersRouter.block, { id: "temp", days: 4000 }, ctx()),
    ).rejects.toThrow();
    await expect(
      call(adminUsersRouter.block, { id: "temp", days: 0 }, ctx()),
    ).rejects.toThrow();
    expect((await db.select().from(user))[0].blocked).toBe(false);
  });

  /**
   * Blocking an administrator would be a way to strip an administrator's
   * access from a screen that must never be able to — the same reason deletion
   * and session revocation refuse it.
   */
  it("refuses to block an admin, or the calling admin's own account", async () => {
    await seedUser("other-admin", { email: ADMIN_EMAIL });
    await seedUser("admin-self", { email: "someone-else@example.com" });

    await expect(
      call(adminUsersRouter.block, { id: "other-admin" }, ctx()),
    ).rejects.toThrow(/out-of-band/);
    await expect(
      call(adminUsersRouter.block, { id: "admin-self" }, ctx()),
    ).rejects.toThrow(/your own account/);

    for (const row of await db.select().from(user)) expect(row.blocked).toBe(false);
  });

  it("404s on an unknown id", async () => {
    await expect(
      call(adminUsersRouter.block, { id: "ghost" }, ctx()),
    ).rejects.toThrow(/not found/i);
  });
});

describe("admin.users.unblock", () => {
  it("refuses a caller who is not an admin", async () => {
    adminState.allow = false;
    await expect(
      call(adminUsersRouter.unblock, { id: "whoever" }, ctx()),
    ).rejects.toThrow(ORPCError);
  });

  /**
   * The guard that shields admin rows exists to stop this screen *removing* an
   * administrator's access. Applying it here would do the opposite: an admin
   * row that is somehow blocked has no other way back, because `adminProcedure`
   * refuses a blocked session and `create-admin` leaves an existing verified
   * account alone. So the restorative actions deliberately have no such guard.
   */
  it("lifts a block on an admin account, and on the caller's own", async () => {
    await seedUser("other-admin", { email: ADMIN_EMAIL, blocked: true });
    await seedUser("admin-self", { email: "someone-else@example.com", blocked: true });

    await expect(
      call(adminUsersRouter.unblock, { id: "other-admin" }, ctx()),
    ).resolves.toMatchObject({ email: ADMIN_EMAIL });
    await expect(
      call(adminUsersRouter.unblock, { id: "admin-self" }, ctx()),
    ).resolves.toMatchObject({ email: "someone-else@example.com" });

    for (const row of await db.select().from(user)) expect(row.blocked).toBe(false);
  });

  it("404s on an unknown id", async () => {
    await expect(
      call(adminUsersRouter.unblock, { id: "ghost" }, ctx()),
    ).rejects.toThrow(/not found/i);
  });

  it("lifts the block and clears what described it", async () => {
    await seedUser("banned", { blocked: true, blockedUntil: hour(24) });

    await call(adminUsersRouter.unblock, { id: "banned" }, ctx());

    const [row] = await db.select().from(user);
    expect(row).toMatchObject({
      blocked: false,
      blockedReason: null,
      blockedAt: null,
      blockedUntil: null,
    });
  });
});

describe("admin.users.list — blocked state", () => {
  it("reports an indefinite block as blocked", async () => {
    await seedUser("banned", { blocked: true });
    const [row] = (await call(adminUsersRouter.list, {}, ctx())).rows;
    expect(row.blocked).toBe(true);
    expect(row.blockedUntil).toBeNull();
  });

  /**
   * A timed block ends on its own — nothing writes the flag back, so the
   * listing must derive "blocked right now" from the expiry, exactly as the
   * auth guard does. If these two ever disagree, an account refused at sign-in
   * would show as active.
   */
  it("reports a lapsed timed block as not blocked, keeping its expiry", async () => {
    await seedUser("served", { blocked: true, blockedUntil: hour(-1) });
    const [row] = (await call(adminUsersRouter.list, {}, ctx())).rows;
    expect(row.blocked).toBe(false);
    expect(row.blockedUntil).not.toBeNull();
  });

  it("filters on the blocked state, not on the stored flag", async () => {
    await seedUser("live-block", { blocked: true });
    await seedUser("lapsed", { blocked: true, blockedUntil: hour(-1) });
    await seedUser("plain");

    const blocked = await call(adminUsersRouter.list, { blocked: true }, ctx());
    expect(blocked.rows.map((r) => r.id)).toEqual(["live-block"]);

    const free = await call(adminUsersRouter.list, { blocked: false }, ctx());
    expect(free.rows.map((r) => r.id).sort()).toEqual(["lapsed", "plain"]);
  });

  it("reports the account-wide sign-in lock in seconds", async () => {
    await seedUser("locked", { email: "locked@example.com" });
    await seedUser("free", { email: "free@example.com" });
    // One attempt past the free allowance earns the base backoff.
    await seedAccountLock("locked@example.com", PER_ACCOUNT.free + 1);

    const rows = (await call(adminUsersRouter.list, {}, ctx())).rows;
    const by = (id: string) => rows.find((r) => r.id === id)!;
    expect(by("locked").signInLockSeconds).toBeGreaterThan(0);
    expect(by("free").signInLockSeconds).toBe(0);
  });
});

describe("admin.users.clearSignInLock", () => {
  it("refuses a caller who is not an admin", async () => {
    adminState.allow = false;
    await expect(
      call(adminUsersRouter.clearSignInLock, { id: "whoever" }, ctx()),
    ).rejects.toThrow(ORPCError);
  });

  it("drops the account-wide counter and says whether there was one", async () => {
    await seedUser("locked", { email: "locked@example.com" });
    await seedAccountLock("locked@example.com", PER_ACCOUNT.free + 1);

    await expect(
      call(adminUsersRouter.clearSignInLock, { id: "locked" }, ctx()),
    ).resolves.toMatchObject({ cleared: true });
    expect(await db.select().from(signInAttempt)).toHaveLength(0);

    await expect(
      call(adminUsersRouter.clearSignInLock, { id: "locked" }, ctx()),
    ).resolves.toMatchObject({ cleared: false });
  });

  /**
   * The per-address counter is what actually bounds password guessing, and it
   * is keyed by a digest of an address this app never stores — so nothing
   * reachable from the admin screen can find or clear one.
   */
  it("leaves the per-address counter alone", async () => {
    await seedUser("locked", { email: "locked@example.com" });
    await db.insert(signInAttempt).values({
      identifier: attemptKey("client:203.0.113.9", "locked@example.com"),
      failedCount: 9,
      lastFailedAt: new Date(),
    });

    await call(adminUsersRouter.clearSignInLock, { id: "locked" }, ctx());

    expect(await db.select().from(signInAttempt)).toHaveLength(1);
  });

  /**
   * The account-wide counter is a lever an outsider can run up against any
   * address they merely know, so withholding the release from admin accounts
   * would leave the accounts most worth attacking as the only ones with no
   * remedy. Releasing it hands back nothing but that counter.
   */
  it("releases the lock on an admin account, and on the caller's own", async () => {
    await seedUser("other-admin", { email: ADMIN_EMAIL });
    await seedUser("admin-self", { email: "someone-else@example.com" });
    await seedAccountLock(ADMIN_EMAIL, PER_ACCOUNT.free + 1);
    await seedAccountLock("someone-else@example.com", PER_ACCOUNT.free + 1);

    await expect(
      call(adminUsersRouter.clearSignInLock, { id: "other-admin" }, ctx()),
    ).resolves.toMatchObject({ cleared: true });
    await expect(
      call(adminUsersRouter.clearSignInLock, { id: "admin-self" }, ctx()),
    ).resolves.toMatchObject({ cleared: true });

    expect(await db.select().from(signInAttempt)).toHaveLength(0);
  });

  it("404s on an unknown id", async () => {
    await expect(
      call(adminUsersRouter.clearSignInLock, { id: "ghost" }, ctx()),
    ).rejects.toThrow(/not found/i);
  });
});
