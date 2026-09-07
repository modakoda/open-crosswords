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
const { categories, entries, languages, puzzles } = await import("@/db/schema");
const { adminRouter } = await import("./admin");

const ctx = () => ({ context: { headers: new Headers() } });

beforeEach(async () => {
  adminState.allow = true;
  await db.execute(
    sql`truncate ${entries}, ${puzzles}, ${languages} restart identity cascade`,
  );
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

  it("keeps the letters the answer's own alphabet counts as its own", async () => {
    await call(adminRouter.languages.create, { code: "lt", name: "Lietuvių" }, ctx());
    const { entry } = await call(
      adminRouter.entries.create,
      { languageCode: "lt", clue: "Plaukioja vandenyje", answer: "žuvis" },
      ctx(),
    );
    expect(entry.answerNormalized).toBe("ŽUVIS");
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

describe("admin.entries.update — moving between languages", () => {
  async function seedEntry(languageCode: string, clue: string, answer = "Paris") {
    const { entry } = await call(
      adminRouter.entries.create,
      { languageCode, clue, answer },
      ctx(),
    );
    return entry;
  }

  it("moves an entry to a language the library already has", async () => {
    await call(adminRouter.languages.create, { code: "lt", name: "Lietuvių" }, ctx());
    const entry = await seedEntry("en", "Capital of France");

    const { entry: moved } = await call(
      adminRouter.entries.update,
      { id: entry.id, patch: { languageCode: "lt" } },
      ctx(),
    );

    expect(moved.languageCode).toBe("lt");
    const en = await call(adminRouter.entries.list, { languageCode: "en" }, ctx());
    expect(en.total).toBe(0);
    const lt = await call(adminRouter.entries.list, { languageCode: "lt" }, ctx());
    expect(lt.rows[0].id).toBe(entry.id);
  });

  it("renormalizes the answer for the language it lands in", async () => {
    await call(adminRouter.languages.create, { code: "lt", name: "Lietuvių" }, ctx());
    await call(adminRouter.languages.create, { code: "en", name: "English" }, ctx());
    const lt = await seedEntry("lt", "Plaukioja vandenyje", "žuvis");
    expect(lt.answerNormalized).toBe("ŽUVIS");

    const { entry: moved } = await call(
      adminRouter.entries.update,
      { id: lt.id, patch: { languageCode: "en" } },
      ctx(),
    );

    // English has no Ž, so the same answer folds to its base letter there.
    expect(moved.answerNormalized).toBe("ZUVIS");
    expect(moved.answer).toBe("žuvis");
  });

  it("drops the category on the way, since categories don't cross languages", async () => {
    await call(adminRouter.languages.create, { code: "lt", name: "Lietuvių" }, ctx());
    const { category } = await call(
      adminRouter.categories.create,
      { languageCode: "en", name: "Geography" },
      ctx(),
    );
    const entry = await seedEntry("en", "Capital of France");
    await call(
      adminRouter.entries.update,
      { id: entry.id, patch: { categoryId: category.id } },
      ctx(),
    );

    const { entry: moved } = await call(
      adminRouter.entries.update,
      { id: entry.id, patch: { languageCode: "lt" } },
      ctx(),
    );
    expect(moved.categoryId).toBeNull();
  });

  it("refuses a category belonging to a different language than the entry", async () => {
    const { category } = await call(
      adminRouter.categories.create,
      { languageCode: "lt", name: "Geografija" },
      ctx(),
    );
    const entry = await seedEntry("en", "Capital of France");

    await expect(
      call(adminRouter.entries.update, { id: entry.id, patch: { categoryId: category.id } }, ctx()),
    ).rejects.toThrow();

    // Nothing was written — the guard runs before the update, not after.
    const data = await call(adminRouter.entries.list, { languageCode: "en" }, ctx());
    expect(data.rows[0].categoryId).toBeNull();
  });

  it("accepts a category created in the language being moved to", async () => {
    const { category } = await call(
      adminRouter.categories.create,
      { languageCode: "lt", name: "Geografija" },
      ctx(),
    );
    const entry = await seedEntry("en", "Capital of France");

    const { entry: moved } = await call(
      adminRouter.entries.update,
      { id: entry.id, patch: { languageCode: "lt", categoryId: category.id } },
      ctx(),
    );
    expect(moved.categoryId).toBe(category.id);
  });

  it("conflicts when the move collides with an existing row", async () => {
    await seedEntry("lt", "Capital of France");
    const entry = await seedEntry("en", "Capital of France");

    await expect(
      call(adminRouter.entries.update, { id: entry.id, patch: { languageCode: "lt" } }, ctx()),
    ).rejects.toThrow(/already exists/);

    // The duplicate is refused, not half-applied.
    const en = await call(adminRouter.entries.list, { languageCode: "en" }, ctx());
    expect(en.total).toBe(1);
  });

  it("rejects a language code that isn't a language code", async () => {
    const entry = await seedEntry("en", "Capital of France");
    await expect(
      call(adminRouter.entries.update, { id: entry.id, patch: { languageCode: "nonsense" } }, ctx()),
    ).rejects.toThrow();
  });

  it("refuses to invent a language on the way — that's languages.create's job", async () => {
    const entry = await seedEntry("en", "Capital of France");

    await expect(
      call(adminRouter.entries.update, { id: entry.id, patch: { languageCode: "de" } }, ctx()),
    ).rejects.toThrow(/No such language/);

    // No stray language was left in the public picker, and the row didn't move.
    const { languages: after } = await call(adminRouter.languages.create, { code: "en" }, ctx());
    expect(after.map((l) => l.code)).not.toContain("de");
    const data = await call(adminRouter.entries.list, { languageCode: "en" }, ctx());
    expect(data.total).toBe(1);
  });
});

describe("admin.entries.deleteMany", () => {
  async function seed(clues: string[]) {
    const ids: string[] = [];
    for (const clue of clues) {
      const { entry } = await call(
        adminRouter.entries.create,
        { languageCode: "en", clue, answer: `Answer${ids.length}` },
        ctx(),
      );
      ids.push(entry.id);
    }
    return ids;
  }

  it("rejects a non-admin, and deletes nothing", async () => {
    const ids = await seed(["Capital of France"]);
    adminState.allow = false;
    await expect(call(adminRouter.entries.deleteMany, { ids }, ctx())).rejects.toThrow();

    // A throw alone would also pass if input parsing ran ahead of the guard;
    // the entry still being there is what pins the gate.
    adminState.allow = true;
    const data = await call(adminRouter.entries.list, {}, ctx());
    expect(data.total).toBe(1);
  });

  it("deletes every selected entry and leaves the rest", async () => {
    const [a, b, c] = await seed(["First clue", "Second clue", "Third clue"]);

    const { deleted } = await call(adminRouter.entries.deleteMany, { ids: [a, c] }, ctx());
    expect(deleted).toBe(2);

    const data = await call(adminRouter.entries.list, {}, ctx());
    expect(data.total).toBe(1);
    expect(data.rows[0].id).toBe(b);
  });

  it("counts only what existed, rather than failing on a stale id", async () => {
    const [a] = await seed(["First clue"]);
    const { deleted } = await call(
      adminRouter.entries.deleteMany,
      { ids: [a, "00000000-0000-0000-0000-000000000000"] },
      ctx(),
    );
    expect(deleted).toBe(1);
  });

  it("rejects an empty selection and a non-uuid id", async () => {
    await expect(call(adminRouter.entries.deleteMany, { ids: [] }, ctx())).rejects.toThrow();
    await expect(
      call(adminRouter.entries.deleteMany, { ids: ["not-a-uuid"] }, ctx()),
    ).rejects.toThrow();
  });

  it("rejects a batch larger than the cap", async () => {
    const ids = Array.from(
      { length: 201 },
      (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    );
    await expect(call(adminRouter.entries.deleteMany, { ids }, ctx())).rejects.toThrow();
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

describe("admin.languages.list", () => {
  it("rejects a non-admin", async () => {
    adminState.allow = false;
    await expect(call(adminRouter.languages.list, undefined, ctx())).rejects.toThrow();
  });

  it("counts what each language holds, so an empty code is visible as one", async () => {
    await call(adminRouter.languages.create, { code: "en", name: "English" }, ctx());
    await call(adminRouter.languages.create, { code: "lt", name: "Lietuvių" }, ctx());
    await call(
      adminRouter.entries.create,
      { languageCode: "en", clue: "Capital of France", answer: "Paris" },
      ctx(),
    );
    await call(
      adminRouter.categories.create,
      { languageCode: "en", name: "Geography" },
      ctx(),
    );

    const { languages: list } = await call(adminRouter.languages.list, undefined, ctx());
    const en = list.find((l) => l.code === "en");
    const lt = list.find((l) => l.code === "lt");
    expect(en).toMatchObject({ entryCount: 1, categoryCount: 1, puzzleCount: 0 });
    expect(lt).toMatchObject({ entryCount: 0, categoryCount: 0, puzzleCount: 0 });
  });
});

describe("admin.languages.delete", () => {
  it("rejects a non-admin", async () => {
    adminState.allow = false;
    await expect(
      call(adminRouter.languages.delete, { code: "lt" }, ctx()),
    ).rejects.toThrow();
  });

  it("removes an empty language, taking its categories with it", async () => {
    await call(adminRouter.languages.create, { code: "lt", name: "Lietuvių" }, ctx());
    await call(adminRouter.languages.create, { code: "en", name: "English" }, ctx());
    await call(adminRouter.categories.create, { languageCode: "lt", name: "Gamta" }, ctx());

    const { languages: list } = await call(
      adminRouter.languages.delete,
      { code: "lt" },
      ctx(),
    );
    expect(list.map((l) => l.code)).toEqual(["en"]);
    expect(await db.select().from(categories)).toHaveLength(0);
  });

  it("refuses while entries are still filed under it", async () => {
    await call(adminRouter.languages.create, { code: "lt", name: "Lietuvių" }, ctx());
    await call(
      adminRouter.entries.create,
      { languageCode: "lt", clue: "Plaukioja vandenyje", answer: "zuvis" },
      ctx(),
    );

    await expect(
      call(adminRouter.languages.delete, { code: "lt" }, ctx()),
    ).rejects.toThrow(/entries or puzzles/i);
    // The refusal has to leave the entry where it was — `entries` cascades, so
    // a delete that slipped through would take it with the language.
    expect(await db.select().from(entries)).toHaveLength(1);
    expect(await db.select().from(languages)).toHaveLength(1);
  });

  it("refuses while puzzles still name it", async () => {
    await call(adminRouter.languages.create, { code: "lt", name: "Lietuvių" }, ctx());
    await db.insert(puzzles).values({
      slug: "amber-quiet-otter-canyon-48392174",
      title: "Test",
      languageCode: "lt",
      paperSize: "a4",
      orientation: "portrait",
      width: 5,
      height: 5,
      seed: "s",
      placements: [],
      grid: [],
    });

    await expect(
      call(adminRouter.languages.delete, { code: "lt" }, ctx()),
    ).rejects.toThrow(/entries or puzzles/i);
    expect(await db.select().from(languages)).toHaveLength(1);
  });

  it("404s rather than reporting a language it never had as in use", async () => {
    await expect(
      call(adminRouter.languages.delete, { code: "lt" }, ctx()),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects a code that isn't one", async () => {
    await expect(
      call(adminRouter.languages.delete, { code: "klingon" }, ctx()),
    ).rejects.toThrow();
  });
});

describe("admin.languages.rename", () => {
  it("rejects a non-admin", async () => {
    adminState.allow = false;
    await expect(
      call(adminRouter.languages.rename, { code: "lt", name: "Lithuanian" }, ctx()),
    ).rejects.toThrow();
  });

  it("changes the display name and leaves the code alone", async () => {
    await call(adminRouter.languages.create, { code: "lt", name: "LT" }, ctx());
    const { languages: list } = await call(
      adminRouter.languages.rename,
      { code: "lt", name: "Lietuvių" },
      ctx(),
    );
    expect(list).toEqual([expect.objectContaining({ code: "lt", name: "Lietuvių" })]);
  });

  it("404s rather than inventing a language it was asked to rename", async () => {
    await expect(
      call(adminRouter.languages.rename, { code: "lt", name: "Lietuvių" }, ctx()),
    ).rejects.toThrow();
  });

  it("rejects an empty name", async () => {
    await call(adminRouter.languages.create, { code: "lt", name: "LT" }, ctx());
    await expect(
      call(adminRouter.languages.rename, { code: "lt", name: "   " }, ctx()),
    ).rejects.toThrow();
  });
});
