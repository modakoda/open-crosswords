import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/** Fresh in-memory Postgres (PGlite) with all Drizzle migrations applied. */
export async function makeTestDb(): Promise<{ db: TestDb; client: PGlite }> {
  const client = new PGlite();
  const dir = resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(resolve(dir, file), "utf8").replaceAll(
      "--> statement-breakpoint",
      "",
    );
    await client.exec(sql);
  }
  return { db: drizzle(client, { schema, casing: "snake_case" }), client };
}
