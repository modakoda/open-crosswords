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
const { languages, puzzles, session, solveStates, user } = await import("@/db/schema");
const { adminUsersRouter } = await import("./admin-users");

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
  }> = {},
) {
  await db.insert(user).values({
    id,
    name: over.name ?? `User ${id}`,
    email: over.email ?? `${id}@example.com`,
    emailVerified: over.emailVerified ?? true,
    ...(over.createdAt ? { createdAt: over.createdAt } : {}),
  });
  return id;
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
    sql`truncate ${puzzles}, ${solveStates}, ${session}, ${languages}, ${user} restart identity cascade`,
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
      "createdAt",
      "email",
      "emailVerified",
      "holdsAdminAddress",
      "id",
      "isAdmin",
      "name",
      "puzzleCount",
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
