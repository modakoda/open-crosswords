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
const { languages, puzzles, solveStates, user } = await import("@/db/schema");
const { adminPuzzlesRouter } = await import("./admin-puzzles");

const ctx = () => ({ context: { headers: new Headers() } });

const placement = (answer: string) => ({
  entryId: crypto.randomUUID(),
  number: 1,
  row: 0,
  col: 0,
  direction: "across",
  answer,
  clue: `Clue for ${answer}`,
});

async function seedPuzzle(
  slug: string,
  over: Partial<{
    title: string;
    languageCode: string;
    userId: string | null;
    words: number;
    createdAt: Date;
  }> = {},
) {
  const [row] = await db
    .insert(puzzles)
    .values({
      slug,
      title: over.title ?? `Puzzle ${slug}`,
      languageCode: over.languageCode ?? "en",
      userId: over.userId ?? null,
      paperSize: "a4",
      orientation: "portrait",
      width: 15,
      height: 15,
      seed: "seed",
      placements: Array.from({ length: over.words ?? 2 }, (_, i) => placement(`WORD${i}`)),
      grid: [],
      ...(over.createdAt ? { createdAt: over.createdAt } : {}),
    })
    .returning({ id: puzzles.id });
  return row.id;
}

beforeEach(async () => {
  adminState.allow = true;
  await db.execute(
    sql`truncate ${puzzles}, ${solveStates}, ${languages}, ${user} restart identity cascade`,
  );
  await db.insert(languages).values([
    { code: "en", name: "English" },
    { code: "lt", name: "Lietuvių" },
  ]);
});

describe("admin.puzzles.list", () => {
  it("rejects a non-admin", async () => {
    adminState.allow = false;
    await expect(call(adminPuzzlesRouter.list, {}, ctx())).rejects.toThrow();
  });

  it("lists every puzzle, newest first, with a total", async () => {
    await seedPuzzle("older", { createdAt: new Date("2026-01-01T00:00:00Z") });
    await seedPuzzle("newer", { createdAt: new Date("2026-02-01T00:00:00Z") });

    const { rows, total } = await call(adminPuzzlesRouter.list, {}, ctx());
    expect(total).toBe(2);
    expect(rows.map((r) => r.slug)).toEqual(["newer", "older"]);
  });

  it("reports the word count and the owner's email", async () => {
    await db.insert(user).values({
      id: "u1",
      name: "Client",
      email: "client@example.com",
      emailVerified: true,
    });
    await seedPuzzle("owned", { userId: "u1", words: 7 });
    await seedPuzzle("anon", { words: 3 });

    const { rows } = await call(adminPuzzlesRouter.list, {}, ctx());
    const bySlug = Object.fromEntries(rows.map((r) => [r.slug, r]));
    expect(bySlug.owned).toMatchObject({ wordCount: 7, ownerEmail: "client@example.com" });
    expect(bySlug.anon).toMatchObject({ wordCount: 3, ownerEmail: null });
  });

  it("filters by language", async () => {
    await seedPuzzle("en-one", { languageCode: "en" });
    await seedPuzzle("lt-one", { languageCode: "lt" });

    const { rows, total } = await call(adminPuzzlesRouter.list, { languageCode: "lt" }, ctx());
    expect(total).toBe(1);
    expect(rows[0].slug).toBe("lt-one");
  });

  it("searches title and slug", async () => {
    await seedPuzzle("amber-quiet-otter-1", { title: "Animals of Europe" });
    await seedPuzzle("brisk-eager-pine-2", { title: "Capital cities" });

    expect((await call(adminPuzzlesRouter.list, { q: "animals" }, ctx())).total).toBe(1);
    expect((await call(adminPuzzlesRouter.list, { q: "brisk" }, ctx())).total).toBe(1);
  });

  it("treats LIKE metacharacters in the search term literally", async () => {
    await seedPuzzle("plain", { title: "Capital cities" });
    expect((await call(adminPuzzlesRouter.list, { q: "%" }, ctx())).total).toBe(0);
  });

  it("pages through the listing", async () => {
    for (let i = 0; i < 3; i++) {
      await seedPuzzle(`p${i}`, { createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`) });
    }
    const page = await call(adminPuzzlesRouter.list, { limit: 2, offset: 2 }, ctx());
    expect(page.total).toBe(3);
    expect(page.rows.map((r) => r.slug)).toEqual(["p0"]);
  });
});

describe("admin.puzzles.rename", () => {
  it("rejects a non-admin", async () => {
    const id = await seedPuzzle("keep");
    adminState.allow = false;
    await expect(
      call(adminPuzzlesRouter.rename, { id, title: "Hacked" }, ctx()),
    ).rejects.toThrow();
  });

  it("retitles the puzzle without touching its slug", async () => {
    const id = await seedPuzzle("stable-slug", { title: "Before" });
    const { puzzle } = await call(adminPuzzlesRouter.rename, { id, title: "After" }, ctx());
    expect(puzzle.title).toBe("After");

    const { rows } = await call(adminPuzzlesRouter.list, {}, ctx());
    expect(rows[0]).toMatchObject({ slug: "stable-slug", title: "After" });
  });

  it("404s on an unknown id", async () => {
    await expect(
      call(adminPuzzlesRouter.rename, { id: crypto.randomUUID(), title: "x" }, ctx()),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects an empty title", async () => {
    const id = await seedPuzzle("p");
    await expect(call(adminPuzzlesRouter.rename, { id, title: "   " }, ctx())).rejects.toThrow();
  });
});

describe("admin.puzzles.delete", () => {
  it("rejects a non-admin", async () => {
    const id = await seedPuzzle("keep");
    adminState.allow = false;
    await expect(call(adminPuzzlesRouter.delete, { id }, ctx())).rejects.toThrow();
    expect((await db.select().from(puzzles)).length).toBe(1);
  });

  it("deletes the puzzle and its saved solve progress", async () => {
    await db.insert(user).values({
      id: "u1",
      name: "Client",
      email: "client@example.com",
      emailVerified: true,
    });
    const id = await seedPuzzle("doomed", { userId: "u1" });
    await db.insert(solveStates).values({ puzzleId: id, userId: "u1", progress: { "0,0": "A" } });

    await expect(call(adminPuzzlesRouter.delete, { id }, ctx())).resolves.toEqual({
      deleted: true,
    });
    expect(await db.select().from(puzzles)).toHaveLength(0);
    expect(await db.select().from(solveStates)).toHaveLength(0);
  });

  it("404s on an unknown id", async () => {
    await expect(
      call(adminPuzzlesRouter.delete, { id: crypto.randomUUID() }, ctx()),
    ).rejects.toThrow(/not found/i);
  });
});
