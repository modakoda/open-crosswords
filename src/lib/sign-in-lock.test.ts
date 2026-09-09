import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const { db } = await import("@/db");
const { signInAttempt } = await import("@/db/schema");
const { attemptKey, PER_ACCOUNT, PER_CLIENT } = await import("./auth-throttle");
const { accountLocks, clearAccountLock } = await import("./sign-in-lock");

const NOW = new Date("2026-06-01T12:00:00.000Z");

async function seedCounter(identifier: string, failedCount: number, at = NOW) {
  await db.insert(signInAttempt).values({ identifier, failedCount, lastFailedAt: at });
}

beforeEach(async () => {
  await db.execute(sql`truncate table ${signInAttempt}`);
});

describe("accountLocks", () => {
  it("asks nothing of the database for an empty page", async () => {
    expect(await accountLocks([], NOW)).toEqual(new Map());
  });

  it("reports seconds left for a locked address and nothing for a free one", async () => {
    await seedCounter(attemptKey("account", "locked@example.com"), PER_ACCOUNT.free + 1);

    const locks = await accountLocks(["locked@example.com", "free@example.com"], NOW);
    expect(locks.get("locked@example.com")).toBeGreaterThan(0);
    expect(locks.has("free@example.com")).toBe(false);
  });

  it("reports nothing while the counter is still inside its free allowance", async () => {
    await seedCounter(attemptKey("account", "some@example.com"), PER_ACCOUNT.free - 1);
    expect(await accountLocks(["some@example.com"], NOW)).toEqual(new Map());
  });

  it("reports nothing once the lock has run out", async () => {
    await seedCounter(attemptKey("account", "some@example.com"), PER_ACCOUNT.free + 1);
    const afterLock = new Date(NOW.getTime() + (PER_ACCOUNT.max + 60) * 1000);
    expect(await accountLocks(["some@example.com"], afterLock)).toEqual(new Map());
  });

  /**
   * The counters are keyed by a digest that normalizes the address the way
   * better-auth looks accounts up, so two spellings share one row. Every
   * address that produced the key must get the answer, not just the first.
   */
  it("answers every spelling of an address that shares one counter", async () => {
    await seedCounter(attemptKey("account", "dup@example.com"), PER_ACCOUNT.free + 1);

    const locks = await accountLocks(["dup@example.com", "DUP@Example.com "], NOW);
    expect(locks.get("dup@example.com")).toBeGreaterThan(0);
    expect(locks.get("DUP@Example.com ")).toBeGreaterThan(0);
  });

  /**
   * The per-address counter is what actually bounds password guessing. It is
   * keyed by a digest of an address this app never stores, so the admin screen
   * must not be able to see it, let alone release it.
   */
  it("never reports the per-address counter", async () => {
    await seedCounter(
      attemptKey("client:203.0.113.9", "locked@example.com"),
      PER_CLIENT.free + 3,
    );
    expect(await accountLocks(["locked@example.com"], NOW)).toEqual(new Map());
  });
});

describe("clearAccountLock", () => {
  it("drops the account-wide row and says whether there was one", async () => {
    await seedCounter(attemptKey("account", "locked@example.com"), PER_ACCOUNT.free + 1);

    expect(await clearAccountLock("locked@example.com")).toBe(true);
    expect(await clearAccountLock("locked@example.com")).toBe(false);
    expect(await db.select().from(signInAttempt)).toHaveLength(0);
  });

  it("leaves the per-address counter in place", async () => {
    const perAddress = attemptKey("client:203.0.113.9", "locked@example.com");
    await seedCounter(perAddress, PER_CLIENT.free + 3);
    await seedCounter(attemptKey("account", "locked@example.com"), PER_ACCOUNT.free + 1);

    await clearAccountLock("locked@example.com");

    const left = await db.select().from(signInAttempt);
    expect(left.map((r) => r.identifier)).toEqual([perAddress]);
  });
});
