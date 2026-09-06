import "./load-env";
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../src/db";
import * as schema from "../src/db/schema";

/**
 * Create (or update the password of) an admin account. Public sign-up at
 * /public/sign-up only ever makes a plain client account, so this is the only
 * way to provision one that can reach /admin — and even then, only if its
 * email is in ADMIN_EMAILS.
 */
async function main() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET must be set");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = (process.argv[2] ?? (await rl.question("Email: "))).trim().toLowerCase();
  const name = process.argv[3] ?? ((await rl.question("Name: ")) || "Admin");
  const password = process.argv[4] ?? (await rl.question("Password (min 12 chars): "));
  rl.close();

  if (password.length < 12) throw new Error("Password must be at least 12 characters");

  const provisioning = betterAuth({
    secret,
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
  if (!(process.env.ADMIN_EMAILS ?? "").toLowerCase().includes(email)) {
    console.warn(`Reminder: add ${email} to ADMIN_EMAILS to grant /admin access.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
