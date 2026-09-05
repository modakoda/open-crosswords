import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Single shared Drizzle client backed by postgres.js. Works against Neon's
 * pooled connection string or any standard Postgres. Runs in the Node.js
 * runtime only.
 */
const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__sql ??
  postgres(env.DATABASE_URL, { max: 10, prepare: false });

if (env.NODE_ENV !== "production") globalForDb.__sql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
