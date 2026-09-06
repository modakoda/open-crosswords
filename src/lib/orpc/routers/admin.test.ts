import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { call } from "@orpc/server";

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
      return { id: "admin", email: "admin@example.com" };
    }),
  };
});

const { db } = await import("@/db");
const { entries, languages } = await import("@/db/schema");
const { adminRouter } = await import("./admin");

const ctx = () => ({ context: { headers: new Headers() } });

beforeEach(async () => {
  adminState.allow = true;
  await db.execute(sql`truncate ${entries}, ${languages} restart identity cascade`);
});

describe("admin.entries.create", () => {
  it("rejects a non-admin", async () => {
    adminState.allow = false;
    await expect(
      call(
        adminRouter.entries.create,
        { languageCode: "en", clue: "Capital of France", answer: "Paris" },
        ctx(),
      ),
    ).rejects.toThrow();
  });

  it("creates an entry and normalizes the answer", async () => {
    const { entry } = await call(
      adminRouter.entries.create,
      { languageCode: "en", clue: "Capital of France", answer: "Paris!" },
      ctx(),
    );
    expect(entry.answerNormalized).toBe("PARIS");
    expect(entry.length).toBe(5);
  });

  it("rejects a too-short clue", async () => {
    await expect(
      call(adminRouter.entries.create, { languageCode: "en", clue: "x", answer: "Paris" }, ctx()),
    ).rejects.toThrow();
  });

  it("rejects an unusable answer", async () => {
    await expect(
      call(
        adminRouter.entries.create,
        { languageCode: "en", clue: "Digits only", answer: "12" },
        ctx(),
      ),
    ).rejects.toThrow();
  });

  it("rejects a duplicate clue/answer", async () => {
    const body = { languageCode: "en", clue: "Capital of France", answer: "Paris" };
    await call(adminRouter.entries.create, body, ctx());
    await expect(call(adminRouter.entries.create, body, ctx())).rejects.toThrow();
  });
});

describe("admin.entries.list", () => {
  it("lists entries for an admin", async () => {
    await call(
      adminRouter.entries.create,
      { languageCode: "en", clue: "Capital of France", answer: "Paris" },
      ctx(),
    );
    const data = await call(adminRouter.entries.list, { languageCode: "en" }, ctx());
    expect(data.total).toBe(1);
    expect(data.rows[0].clue).toBe("Capital of France");
  });

  it("filters by language and can list every language at once", async () => {
    await call(adminRouter.languages.create, { code: "lt" }, ctx());
    await call(
      adminRouter.entries.create,
      { languageCode: "en", clue: "Capital of France", answer: "Paris" },
      ctx(),
    );
    await call(
      adminRouter.entries.create,
      { languageCode: "lt", clue: "Prancuzijos sostine", answer: "Paryzius" },
      ctx(),
    );

    const lt = await call(adminRouter.entries.list, { languageCode: "lt" }, ctx());
    expect(lt.total).toBe(1);
    expect(lt.rows[0].languageCode).toBe("lt");

    const all = await call(adminRouter.entries.list, {}, ctx());
    expect(all.total).toBe(2);
    expect(all.rows.map((r) => r.languageCode).sort()).toEqual(["en", "lt"]);
  });

  it("labels each row with its own category name", async () => {
    const { category } = await call(
      adminRouter.categories.create,
      { languageCode: "en", name: "Geography" },
      ctx(),
    );
    await call(
      adminRouter.entries.create,
      {
        languageCode: "en",
        clue: "Capital of France",
        answer: "Paris",
        categoryId: category.id,
      },
      ctx(),
    );
    await call(
      adminRouter.entries.create,
      { languageCode: "en", clue: "Uncategorised clue", answer: "Alpha" },
      ctx(),
    );

    const data = await call(adminRouter.entries.list, { languageCode: "en" }, ctx());
    const byClue = Object.fromEntries(data.rows.map((r) => [r.clue, r.categoryName]));
    expect(byClue["Capital of France"]).toBe("Geography");
    expect(byClue["Uncategorised clue"]).toBeNull();
  });
});

describe("admin.entries.update / delete", () => {
  it("404s updating an entry that doesn't exist", async () => {
    await expect(
      call(
        adminRouter.entries.update,
        { id: "00000000-0000-0000-0000-000000000000", patch: { enabled: false } },
        ctx(),
      ),
    ).rejects.toThrow();
  });

  it("toggles and then deletes an entry", async () => {
    const { entry } = await call(
      adminRouter.entries.create,
      { languageCode: "en", clue: "Capital of France", answer: "Paris" },
      ctx(),
    );
    const { entry: updated } = await call(
      adminRouter.entries.update,
      { id: entry.id, patch: { enabled: false } },
      ctx(),
    );
    expect(updated.enabled).toBe(0);

    const { deleted } = await call(adminRouter.entries.delete, { id: entry.id }, ctx());
    expect(deleted).toBe(true);
  });
});

describe("admin.entries.import", () => {
  it("rejects malformed JSON", async () => {
    await expect(
      call(
        adminRouter.entries.import,
        { languageCode: "en", format: "json", text: "not json", createMissingCategories: true },
        ctx(),
      ),
    ).rejects.toThrow();
  });

  it("rejects a CSV missing required header columns", async () => {
    await expect(
      call(
        adminRouter.entries.import,
        {
          languageCode: "en",
          format: "csv",
          text: "foo,bar\n1,2",
          createMissingCategories: true,
        },
        ctx(),
      ),
    ).rejects.toThrow();
  });

  it("imports valid JSON rows", async () => {
    const result = await call(
      adminRouter.entries.import,
      {
        languageCode: "en",
        format: "json",
        text: JSON.stringify([{ clue: "Capital of France", answer: "Paris" }]),
        createMissingCategories: true,
      },
      ctx(),
    );
    expect(result.inserted).toBe(1);
  });
});

describe("admin.entries.aiDraft", () => {
  it("is unavailable when ANTHROPIC_API_KEY is unset (test env)", async () => {
    await expect(
      call(
        adminRouter.entries.aiDraft,
        { languageCode: "en", topic: "World capitals", count: 5 },
        ctx(),
      ),
    ).rejects.toThrow();
  });
});

describe("admin.languages.create", () => {
  it("rejects a non-admin", async () => {
    adminState.allow = false;
    await expect(call(adminRouter.languages.create, { code: "lt" }, ctx())).rejects.toThrow();
  });

  it("persists the language and returns the full list", async () => {
    const { languages: list } = await call(adminRouter.languages.create, { code: "LT" }, ctx());
    expect(list.map((l) => l.code)).toContain("lt");
    expect(await db.select().from(languages)).toHaveLength(1);
  });

  it("is idempotent and keeps the original name", async () => {
    await call(adminRouter.languages.create, { code: "lt", name: "Lithuanian" }, ctx());
    const { languages: list } = await call(adminRouter.languages.create, { code: "lt" }, ctx());
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Lithuanian");
  });

  it("rejects a code that is not BCP-47 shaped", async () => {
    await expect(
      call(adminRouter.languages.create, { code: "klingon" }, ctx()),
    ).rejects.toThrow();
  });
});
