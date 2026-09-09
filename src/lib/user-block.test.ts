import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const { db } = await import("@/db");
const { session, user } = await import("@/db/schema");
const { blockUser, isBlocked, isUserBlocked, readBlockState, unblockUser } =
  await import("./user-block");

const NOW = new Date("2026-06-01T12:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

async function seedUser(id = "u1") {
  await db.insert(user).values({ id, name: id, email: `${id}@example.com` });
  return id;
}

beforeEach(async () => {
  await db.execute(sql`truncate ${session}, ${user} restart identity cascade`);
});

describe("isBlocked", () => {
  it("is false when nobody blocked the account", () => {
    expect(isBlocked({ blocked: false, blockedUntil: null }, NOW)).toBe(false);
    // An expiry left behind by a lifted block changes nothing on its own.
    expect(isBlocked({ blocked: false, blockedUntil: later(1000) }, NOW)).toBe(false);
  });

  it("is true for an indefinite block", () => {
    expect(isBlocked({ blocked: true, blockedUntil: null }, NOW)).toBe(true);
  });

  it("ends exactly at the expiry, without anything writing the flag back", () => {
    expect(isBlocked({ blocked: true, blockedUntil: later(1) }, NOW)).toBe(true);
    expect(isBlocked({ blocked: true, blockedUntil: NOW }, NOW)).toBe(false);
    expect(isBlocked({ blocked: true, blockedUntil: later(-1) }, NOW)).toBe(false);
  });
});

describe("blockUser", () => {
  it("records the block and ends every session of that account", async () => {
    await seedUser("target");
    await seedUser("bystander");
    for (const [id, userId] of [
      ["s1", "target"],
      ["s2", "target"],
      ["s3", "bystander"],
    ]) {
      await db.insert(session).values({
        id,
        token: `token-${id}`,
        userId,
        expiresAt: later(3_600_000),
      });
    }

    const res = await blockUser("target", {
      reason: "Abuse",
      until: later(86_400_000),
      now: NOW,
    });
    expect(res).toEqual({ blocked: true, revokedSessions: 2 });

    const state = await readBlockState("target");
    expect(state).toMatchObject({ blocked: true, blockedReason: "Abuse" });
    expect(state!.blockedAt).toEqual(NOW);
    expect(state!.blockedUntil).toEqual(later(86_400_000));

    // Nobody else is signed out.
    const left = await db.select({ id: session.id }).from(session);
    expect(left).toEqual([{ id: "s3" }]);
  });

  it("reports nothing blocked for an id that does not exist", async () => {
    expect(await blockUser("ghost")).toEqual({ blocked: false, revokedSessions: 0 });
  });

  it("replaces an earlier block rather than layering on it", async () => {
    await seedUser();
    await blockUser("u1", { reason: "First", until: later(1000), now: NOW });
    await blockUser("u1", { now: NOW });

    const state = await readBlockState("u1");
    expect(state).toMatchObject({ blocked: true, blockedReason: null });
    expect(state!.blockedUntil).toBeNull();
  });
});

describe("unblockUser", () => {
  /**
   * The reason and dates describe a block that is over; leaving them would
   * make a plain account read as one still serving a lapsed sentence.
   */
  it("clears the flag and everything that described it", async () => {
    await seedUser();
    await blockUser("u1", { reason: "Abuse", until: later(1000), now: NOW });

    expect(await unblockUser("u1")).toBe(true);
    expect(await readBlockState("u1")).toEqual({
      blocked: false,
      blockedReason: null,
      blockedAt: null,
      blockedUntil: null,
    });
  });

  it("reports nothing lifted for an id that does not exist", async () => {
    expect(await unblockUser("ghost")).toBe(false);
  });
});

describe("isUserBlocked", () => {
  it("agrees with the stored state, expiry included", async () => {
    await seedUser();
    expect(await isUserBlocked("u1", NOW)).toBe(false);

    await blockUser("u1", { until: later(1000), now: NOW });
    expect(await isUserBlocked("u1", NOW)).toBe(true);
    expect(await isUserBlocked("u1", later(2000))).toBe(false);
  });

  /** An unknown id is not a blocked account; it is no account at all. */
  it("reads an unknown id as not blocked", async () => {
    expect(await isUserBlocked("ghost")).toBe(false);
  });

  it("does not confuse one account's block with another's", async () => {
    await seedUser("a");
    await seedUser("b");
    await blockUser("a", { now: NOW });

    expect(await isUserBlocked("a", NOW)).toBe(true);
    expect(await isUserBlocked("b", NOW)).toBe(false);
    expect(await db.select().from(user).where(eq(user.id, "b"))).toHaveLength(1);
  });
});
