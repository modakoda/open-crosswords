import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/db");
  const store = await makeTestDb();
  return { db: store.db, schema: await import("@/db/schema") };
});

const adminState = { allow: true };
vi.mock("@/lib/auth-guard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-guard")>(
    "@/lib/auth-guard",
  );
  return {
    ...actual,
    requireAdmin: vi.fn(async () => {
      if (!adminState.allow) throw new actual.ForbiddenError("no");
      return { id: "admin", email: "admin@example.com" };
    }),
  };
});

const { db } = await import("@/db");
const { entries, languages } = await import("@/db/schema");
const { GET, POST } = await import("./route");

function post(body: unknown) {
  return new Request("http://localhost/api/admin/entries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  adminState.allow = true;
  await db.execute(sql`truncate ${entries}, ${languages} restart identity cascade`);
});

describe("/api/admin/entries", () => {
  it("returns 403 for a non-admin", async () => {
    adminState.allow = false;
    const res = await POST(post({ languageCode: "en", clue: "Capital of France", answer: "Paris" }));
    expect(res.status).toBe(403);
  });

  it("creates an entry (201) and normalizes the answer", async () => {
    const res = await POST(
      post({ languageCode: "en", clue: "Capital of France", answer: "Paris!" }),
    );
    expect(res.status).toBe(201);
    const { entry } = await res.json();
    expect(entry.answerNormalized).toBe("PARIS");
    expect(entry.length).toBe(5);
  });

  it("rejects a too-short clue with 400", async () => {
    const res = await POST(post({ languageCode: "en", clue: "x", answer: "Paris" }));
    expect(res.status).toBe(400);
  });

  it("rejects an unusable answer with 422", async () => {
    const res = await POST(post({ languageCode: "en", clue: "Digits only", answer: "12" }));
    expect(res.status).toBe(422);
  });

  it("returns 409 on a duplicate clue/answer", async () => {
    const body = { languageCode: "en", clue: "Capital of France", answer: "Paris" };
    await POST(post(body));
    const res = await POST(post(body));
    expect(res.status).toBe(409);
  });

  it("lists entries for an admin", async () => {
    await POST(post({ languageCode: "en", clue: "Capital of France", answer: "Paris" }));
    const res = await GET(
      new Request("http://localhost/api/admin/entries?languageCode=en"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(data.rows[0].clue).toBe("Capital of France");
  });
});
