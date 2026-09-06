import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const { db } = await import("@/db");
const { signInAttempt } = await import("@/db/schema");
const {
  attemptKey,
  clearSignInAttempts,
  consumeSignInAttempt,
  pruneDecayedAttempts,
  DECAY_SECONDS,
  PER_ACCOUNT,
  PER_CLIENT,
} = await import("./auth-throttle");

const EMAIL = "victim@example.com";
const IP = "203.0.113.5";
const T0 = new Date("2026-01-01T12:00:00Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

/** Attempts from one address, returning the wait each one was told to serve. */
async function attempt(times: number, ip: string | null = IP, now = T0) {
  const waits: number[] = [];
  for (let i = 0; i < times; i++) {
    waits.push(await consumeSignInAttempt(EMAIL, ip, now));
  }
  return waits;
}

beforeEach(async () => {
  await db.execute(sql`truncate table ${signInAttempt}`);
});

describe("consumeSignInAttempt", () => {
  it("allows the free attempts, then locks", async () => {
    const waits = await attempt(PER_CLIENT.free + 1);
    expect(waits.slice(0, PER_CLIENT.free)).toEqual(
      Array(PER_CLIENT.free).fill(0),
    );
    expect(waits.at(-1)).toBe(PER_CLIENT.base);
  });

  it("refuses the locked attempt without counting it", async () => {
    await attempt(PER_CLIENT.free + 3);
    // The lock is still the first one earned, not one doubled three times.
    expect(await consumeSignInAttempt(EMAIL, IP, T0)).toBe(PER_CLIENT.base);
  });

  it("does not extend the lock when a locked-out caller keeps trying", async () => {
    await attempt(PER_CLIENT.free + 1);
    expect(await consumeSignInAttempt(EMAIL, IP, at(30))).toBe(
      PER_CLIENT.base - 30,
    );
    expect(await consumeSignInAttempt(EMAIL, IP, at(PER_CLIENT.base))).toBe(0);
  });

  it("gives the caller an attempt once the lock expires, then doubles it", async () => {
    await attempt(PER_CLIENT.free + 1);
    // Waiting the backoff out earns one attempt, not another refusal.
    expect(await consumeSignInAttempt(EMAIL, IP, at(PER_CLIENT.base))).toBe(0);
    expect(await consumeSignInAttempt(EMAIL, IP, at(PER_CLIENT.base))).toBe(
      PER_CLIENT.base * 2,
    );
  });

  it("caps the backoff so a run of failures never locks an address out for good", async () => {
    let clock = 0;
    for (let i = 0; i < PER_CLIENT.free + 12; i++) {
      const wait = await consumeSignInAttempt(EMAIL, IP, at(clock));
      expect(wait).toBeLessThanOrEqual(PER_CLIENT.max);
      clock += wait;
    }
  });

  it("does not spend the account-wide budget on refused attempts", async () => {
    await attempt(PER_CLIENT.free + 20);
    const [account] = await db
      .select()
      .from(signInAttempt)
      .where(eq(signInAttempt.identifier, attemptKey("account", EMAIL)));
    expect(account?.failedCount).toBe(PER_CLIENT.free);
  });

  it("does not spend the caller's budget while the account-wide lock is on", async () => {
    for (let i = 0; i < PER_ACCOUNT.free; i++) {
      await consumeSignInAttempt(EMAIL, `198.51.100.${i}`, T0);
    }
    // The owner, whose own counter is untouched, is refused by the account
    // lock — and must not be charged for it, or an attacker's flood would run
    // the owner's counter up too.
    expect(await consumeSignInAttempt(EMAIL, IP, T0)).toBeGreaterThan(0);
    const [client] = await db
      .select()
      .from(signInAttempt)
      .where(eq(signInAttempt.identifier, attemptKey(`client:${IP}`, EMAIL)));
    expect(client?.failedCount).toBe(0);
  });

  it("counts an unattributable caller against the account only", async () => {
    await attempt(PER_CLIENT.free + 1, null);
    // No shared per-account bucket for anonymous callers: six requests from
    // nowhere must not lock an account everyone else can still reach.
    expect(await consumeSignInAttempt(EMAIL, IP, T0)).toBe(0);
  });

  it("locks one address without locking the account elsewhere", async () => {
    await attempt(PER_CLIENT.free + 1);
    expect(await consumeSignInAttempt(EMAIL, "198.51.100.7", T0)).toBe(0);
  });

  it("locks the account everywhere once a distributed run crosses the ceiling", async () => {
    for (let i = 0; i < PER_ACCOUNT.free; i++) {
      await consumeSignInAttempt(EMAIL, `198.51.100.${i}`, T0);
    }
    expect(await consumeSignInAttempt(EMAIL, "203.0.113.99", T0)).toBe(
      PER_ACCOUNT.base,
    );
  });

  it("counts every attempt when they arrive together", async () => {
    const waits = await Promise.all(
      Array.from({ length: PER_CLIENT.free + 1 }, () =>
        consumeSignInAttempt(EMAIL, IP, T0),
      ),
    );
    expect(waits.filter((w) => w > 0)).toHaveLength(1);
  });

  it("shares one counter across case and whitespace variants of an email", async () => {
    await attempt(PER_CLIENT.free);
    expect(await consumeSignInAttempt("  VICTIM@Example.com ", IP, T0)).toBe(
      PER_CLIENT.base,
    );
  });

  it("locks an unregistered email just like a registered one", async () => {
    const waits = [];
    for (let i = 0; i < PER_CLIENT.free + 1; i++) {
      waits.push(await consumeSignInAttempt("no-such@example.com", IP, T0));
    }
    expect(waits.at(-1)).toBe(PER_CLIENT.base);
  });

  it("starts a fresh run once an old one has decayed", async () => {
    await attempt(PER_CLIENT.free + 1);
    expect(await consumeSignInAttempt(EMAIL, IP, at(DECAY_SECONDS + 1))).toBe(0);
  });

  it("does not lock a caller whose clock trails a just-committed attempt", async () => {
    // A request that waited on the row lock can carry a `now` from before the
    // attempt that beat it to the row; that must not read as time owed.
    await consumeSignInAttempt(EMAIL, IP, at(5));
    expect(await consumeSignInAttempt(EMAIL, IP, T0)).toBe(0);
  });

  it("counts a first burst of parallel attempts, not just one of them", async () => {
    await Promise.all(
      Array.from({ length: 8 }, () => consumeSignInAttempt(EMAIL, IP, T0)),
    );
    const [client] = await db
      .select()
      .from(signInAttempt)
      .where(eq(signInAttempt.identifier, attemptKey(`client:${IP}`, EMAIL)));
    expect(client?.failedCount).toBe(PER_CLIENT.free);
  });

  it("stores keyed digests, never the address itself", async () => {
    await attempt(1);
    const rows = await db.select().from(signInAttempt);
    expect(rows.map((r) => r.identifier).sort()).toEqual(
      [attemptKey(`client:${IP}`, EMAIL), attemptKey("account", EMAIL)].sort(),
    );
    expect(rows.some((r) => r.identifier.includes("victim"))).toBe(false);
  });
});

describe("clearSignInAttempts", () => {
  it("releases this caller's counter", async () => {
    await attempt(PER_CLIENT.free + 1);
    await clearSignInAttempts(EMAIL, IP);
    expect(await consumeSignInAttempt(EMAIL, IP, T0)).toBe(0);
  });

  it("gives the account-wide counter one attempt back, rather than clearing it", async () => {
    await attempt(3);
    await clearSignInAttempts(EMAIL, IP);

    const [account] = await db
      .select()
      .from(signInAttempt)
      .where(eq(signInAttempt.identifier, attemptKey("account", EMAIL)));
    // Down by one, not wiped: an attacker's failures still accumulate, and a
    // probe can't read "the owner just signed in" off a reset counter.
    expect(account?.failedCount).toBe(2);
  });

  it("never drives the account-wide counter below zero", async () => {
    await attempt(1);
    for (let i = 0; i < 3; i++) await clearSignInAttempts(EMAIL, IP);

    const [account] = await db
      .select()
      .from(signInAttempt)
      .where(eq(signInAttempt.identifier, attemptKey("account", EMAIL)));
    expect(account?.failedCount).toBe(0);
  });
});

describe("pruneDecayedAttempts", () => {
  it("clears decayed rows and keeps live ones", async () => {
    await consumeSignInAttempt("old@example.com", IP, T0);
    await consumeSignInAttempt(EMAIL, IP, at(DECAY_SECONDS));

    await pruneDecayedAttempts(at(DECAY_SECONDS + 1));

    const rows = await db.select().from(signInAttempt);
    expect(rows.map((r) => r.identifier).sort()).toEqual(
      [attemptKey(`client:${IP}`, EMAIL), attemptKey("account", EMAIL)].sort(),
    );
  });
});
