import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

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
const { attemptKey, consumeSignInAttempt, PER_ACCOUNT, PER_CLIENT } = await import(
  "./auth-throttle"
);
const { KNOWN_DEVICE_COOKIE } = await import("./known-device");

/** The account-wide counter's current value. */
async function accountCount(): Promise<number> {
  const [row] = await db
    .select()
    .from(signInAttempt)
    .where(eq(signInAttempt.identifier, attemptKey("account", EMAIL)));
  return row?.failedCount ?? 0;
}

const EMAIL = "member@example.com";
const PASSWORD = "correct-horse-battery";

/** Drives the real HTTP handler, so router-level rate limiting applies too. */
async function post(
  path: string,
  body: unknown,
  cookie?: string,
): Promise<Response> {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

/** The full Set-Cookie line for one cookie, attributes included. */
function setCookie(res: Response, name: string): string | undefined {
  return res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
}

/** Every cookie a response sets, as a request header. */
function cookiesFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/** Just the device cookie, as a request header — never the session with it. */
function deviceCookieFrom(res: Response): string {
  const line = setCookie(res, KNOWN_DEVICE_COOKIE);
  expect(line).toBeDefined();
  return line!.split(";")[0]!;
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

// Each request runs a real password hash, so a loaded machine can take much
// longer than vitest's default per-test budget.
const TIMEOUT = 60_000;

describe("sign-in throttling", { timeout: TIMEOUT }, () => {
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

  it("is neither reset nor advanced by a request that fails body validation", async () => {
    await signUp();

    for (let i = 0; i < PER_CLIENT.free - 1; i++) {
      expect((await signIn("wrong-password-here")).status).toBe(401);
    }
    // A body that can't reach password verification is not a sign-in attempt:
    // counting it would let an attacker spend an account's budget for free,
    // and treating it as a success would clear the backoff between guesses.
    // better-call throws its own error class here, which is not the class
    // better-auth throws, so "no error I recognize" is not success.
    expect((await malformedSignIn()).status).toBe(400);
    expect((await signIn("wrong-password-here")).status).toBe(401);
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

describe("known devices", { timeout: TIMEOUT }, () => {
  /** Spends the account-wide budget, as a distributed guessing run would. */
  async function exhaustAccountBudget() {
    for (let i = 0; i < PER_ACCOUNT.free; i++) {
      await consumeSignInAttempt(EMAIL, `198.51.100.${i}`);
    }
  }

  it("issues a cookie on success that carries the account past its lock", async () => {
    await signUp();
    const success = await signIn(PASSWORD);
    expect(success.status).toBe(200);
    // The device cookie alone, so the session cookie can't be what gets the
    // later request through.
    const device = deviceCookieFrom(success);

    await exhaustAccountBudget();

    expect((await signIn("wrong-password-here")).status).toBe(429);
    expect(
      (await post("/sign-in/email", { email: EMAIL, password: PASSWORD }, device))
        .status,
    ).toBe(200);
  });

  it("keeps the cookie out of scripts and off other sites", async () => {
    await signUp();
    const line = setCookie(await signIn(PASSWORD), KNOWN_DEVICE_COOKIE) ?? "";
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Strict/i);
    expect(line).toMatch(/Max-Age=\d+/i);
    // A digest, never the address it stands for.
    expect(line).not.toContain(EMAIL.split("@")[0]);
  });

  it("does not release what an exempt attempt never counted", async () => {
    await signUp();
    const device = deviceCookieFrom(await signIn(PASSWORD));
    await exhaustAccountBudget();

    const before = await accountCount();
    // Signing in as a known device skips the account-wide counter, so it must
    // not hand an attempt back either: one-sided erosion would pin that
    // counter at zero for any account with regular sign-ins and lose the only
    // bound on a distributed run.
    expect(
      (await post("/sign-in/email", { email: EMAIL, password: PASSWORD }, device))
        .status,
    ).toBe(200);
    expect(await accountCount()).toBe(before);
  });

  it("forgets the browser when it signs out", async () => {
    await signUp();
    const session = cookiesFrom(await signIn(PASSWORD));
    const out = await post("/sign-out", {}, session);
    const line = setCookie(out, KNOWN_DEVICE_COOKIE) ?? "";
    expect(line).toMatch(/Max-Age=0/i);
  });
});

describe("rate limit storage", { timeout: TIMEOUT }, () => {
  it("keeps its counters in the database, not in process memory", async () => {
    await signIn("wrong-password-here");
    const rows = await db.select().from(rateLimit);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.key).toContain("/sign-in/email");
  });
});
