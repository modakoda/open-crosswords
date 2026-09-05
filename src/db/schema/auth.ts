import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Tables required by better-auth's Drizzle adapter. Column names/shapes follow
 * the better-auth schema contract — do not rename without regenerating auth.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    // Required by better-auth >=1.7 (identifies the auth provider instance,
    // e.g. "credential" for email+password) — added when the installed
    // version's schema contract moved ahead of this file; keep in sync with
    // `npx auth@latest generate` if better-auth is upgraded again.
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_issuer_account_id_uidx").on(t.issuer, t.accountId),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * better-auth's own rate-limit counters. Registered with the Drizzle adapter so
 * `rateLimit.storage: "database"` in ./auth.ts shares one counter across every
 * instance — the default in-memory store is per-process, so on a multi-instance
 * or serverless deployment the effective sign-in limit was multiplied by the
 * number of live instances and reset on every cold start.
 *
 * Shape follows better-auth's schema contract (key/count/lastRequest); do not
 * rename the fields. `lastRequest` is epoch milliseconds, so it needs bigint.
 */
export const rateLimit = pgTable(
  "rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  // better-auth sweeps rows past the longest window by `last_request`.
  (t) => [index("rate_limit_last_request_idx").on(t.lastRequest)],
);

/**
 * Sign-in attempt counters behind the exponential backoff in
 * src/lib/auth-throttle.ts — one row per account-and-caller and one per
 * account. The IP-keyed limiter above does nothing against a distributed
 * guess-one-account attack, so attempts are counted per identifier too.
 *
 * `identifier` is a keyed digest of the scope and the lowercased email, never
 * the address itself: a row exists for any attempted email, including ones with
 * no account, so the table must not become a list of who does and doesn't have
 * an account.
 */
export const signInAttempt = pgTable(
  "sign_in_attempt",
  {
    identifier: text("identifier").primaryKey(),
    failedCount: integer("failed_count").notNull().default(0),
    lastFailedAt: timestamp("last_failed_at").notNull().defaultNow(),
  },
  // Supports the sweep of decayed rows in src/lib/auth-throttle.ts.
  (t) => [index("sign_in_attempt_last_failed_at_idx").on(t.lastFailedAt)],
);
