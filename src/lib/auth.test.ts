import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

// The Next cookie plugin writes through next/headers, which has no request
// scope in a unit test.
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: () => {}, get: () => undefined }),
}));

const { db } = await import("@/db");
const { rateLimit, signInAttempt } = await import("@/db/schema");
const { auth } = await import("./auth");
const { PER_CLIENT } = await import("./auth-throttle");

const EMAIL = "member@example.com";
const PASSWORD = "correct-horse-battery";

/** Drives the real HTTP handler, so router-level rate limiting applies too. */
async function post(path: string, body: unknown): Promise<Response> {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/** A body that fails schema validation before the endpoint ever runs. */
async function malformedSignIn(): Promise<Response> {
  return post("/sign-in/email", { email: EMAIL, password: 12345 });
}

async function signIn(password: string): Promise<Response> {
  return post("/sign-in/email", { email: EMAIL, password });
}

async function signUp(): Promise<Response> {
  return post("/sign-up/email", { name: "Member", email: EMAIL, password: PASSWORD });
}

beforeEach(async () => {
  await db.execute(sql`truncate table ${signInAttempt}`);
  await db.execute(sql`truncate table ${rateLimit}`);
});

describe("sign-in throttling", () => {
  it("locks the account out after a run of wrong passwords", async () => {
    await signUp();

    for (let i = 0; i < PER_CLIENT.free; i++) {
      expect((await signIn("wrong-password-here")).status).toBe(401);
    }
    // Past the free attempts every request is refused outright, the correct
    // password included, until the backoff expires.
    const locked = await signIn("wrong-password-here");
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await signIn(PASSWORD)).status).toBe(429);
  });

  it("cannot be reset by a request that fails body validation", async () => {
    await signUp();

    for (let i = 0; i < PER_CLIENT.free - 1; i++) {
      expect((await signIn("wrong-password-here")).status).toBe(401);
    }
    // better-call throws its own error class for a bad body, which is not the
    // error class better-auth throws — treating "no error I recognize" as a
    // successful sign-in here would clear the counter and hand an attacker
    // unlimited guesses.
    expect((await malformedSignIn()).status).toBe(400);
    expect((await signIn("wrong-password-here")).status).toBe(429);
  });

  it("releases the caller's counter on a successful sign-in", async () => {
    await signUp();

    expect((await signIn("wrong-password-here")).status).toBe(401);
    expect((await signIn(PASSWORD)).status).toBe(200);
    for (let i = 0; i < PER_CLIENT.free; i++) {
      expect((await signIn("wrong-password-here")).status).toBe(401);
    }
  });
});

describe("rate limit storage", () => {
  it("keeps its counters in the database, not in process memory", async () => {
    await signIn("wrong-password-here");
    const rows = await db.select().from(rateLimit);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.key).toContain("/sign-in/email");
  });
});
