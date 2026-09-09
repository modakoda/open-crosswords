import { sql } from "drizzle-orm";

/**
 * "Now", as the naive UTC wall-clock these tables are written in.
 *
 * Every `timestamp` column in this schema is `timestamp without time zone`
 * holding UTC, so a bare `now()` (a `timestamptz`) is coerced using the
 * *server's* TimeZone and is off by that offset on any deployment not set to
 * UTC — silently mis-classifying expired sessions and lapsed blocks. Binding a
 * JS `Date` instead is worse: it reaches the driver untyped inside a raw `sql`
 * fragment and Postgres refuses the comparison outright. Converting in SQL
 * avoids both.
 */
export const NOW_UTC = sql`(now() at time zone 'utc')`;
