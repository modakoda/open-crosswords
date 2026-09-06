import "./load-env";
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../src/db";
import * as schema from "../src/db/schema";
import { env } from "../src/lib/env/server";

/**
 * Create an admin account, if one does not already exist for that email.
 * Public sign-up at
 * /public/sign-up only ever makes a plain client account, so this is the only
 * way to provision one that can reach /admin — and even then, only if its
 * email is in ADMIN_EMAILS.
 */
async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = (process.argv[2] ?? (await rl.question("Email: "))).trim().toLowerCase();
  const name = process.argv[3] ?? ((await rl.question("Name: ")) || "Admin");
  // ADMIN_PASSWORD lets a caller (the Tiltfile does) supply the password
  // without putting it on a command line every local user can read in `ps`.
  const password =
    process.argv[4] ??
    process.env.ADMIN_PASSWORD ??
    (await rl.question("Password (min 12 chars): "));
  rl.close();

  if (password.length < 12) throw new Error("Password must be at least 12 characters");

  // Idempotent: an existing account keeps the password it already has, so
  // re-running this (Tilt does, on every `tilt up`) never silently resets one.
  const [existing] = await db
    .select({ emailVerified: schema.user.emailVerified })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  if (existing) {
    // An unverified account is one this script did not create: anyone may
    // register any address at /public/sign-up, and only this script marks an
    // email verified. Say so loudly rather than let it read as provisioned —
    // verifying that row by hand would hand /admin to whoever registered it.
    if (!existing.emailVerified) {
      console.error(
        `An unverified account already holds ${email} — it was created by someone signing up, not by this script.\n` +
          `Leave it unverified unless you know who owns it; use a different address for the admin login.`,
      );
      process.exit(1);
    }
    console.log(`Admin user ${email} already exists — password left unchanged.`);
    if (!env.ADMIN_EMAILS.includes(email)) {
      console.warn(`Reminder: add ${email} to ADMIN_EMAILS to grant /admin access.`);
    }
    process.exit(0);
  }

  const provisioning = betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: { enabled: true, disableSignUp: false, minPasswordLength: 12 },
  });

  await provisioning.api.signUpEmail({ body: { email, name, password } });
  // This is a trusted out-of-band provisioning step — mark the email verified
  // so the admin gate (which requires emailVerified) accepts the account.
  await db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(eq(schema.user.email, email));
  console.log(`Created admin user ${email}.`);
  if (!env.ADMIN_EMAILS.includes(email)) {
    console.warn(`Reminder: add ${email} to ADMIN_EMAILS to grant /admin access.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
