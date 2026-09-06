import "./scripts/load-env";
import { defineConfig } from "drizzle-kit";
import { env } from "./src/lib/env";

// The connection string is validated by src/lib/env.ts, the one place every
// environment variable in this project is declared — drizzle-kit gets the same
// checked value the app runs on rather than its own ad-hoc read.
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_URL },
  casing: "snake_case",
});
