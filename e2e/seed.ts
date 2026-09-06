import "../scripts/load-env";
import { inArray } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../src/db";
import * as schema from "../src/db/schema";
import { env } from "../src/lib/env/server";
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_CLIENT_EMAIL,
  E2E_CLIENT_PASSWORD,
  E2E_CLIENT2_EMAIL,
  E2E_CLIENT2_PASSWORD,
  E2E_LANGUAGE_CODE,
  E2E_LANGUAGE_NAME,
  E2E_SIGNUP_EMAIL,
  E2E_UI_LANGUAGE_CODE,
} from "./constants";

/** Reliably interlocks into a crossword — verified in src/lib/puzzles/queries.test.ts. */
const WORDS = [
  "Paris",
  "Rome",
  "Oslo",
  "Bern",
  "Tokyo",
  "Cairo",
  "Lima",
  "Delhi",
  "Seoul",
  "Accra",
  "Dublin",
  "Vienna",
];

async function seedEntries(languageCode: string) {
  await db
    .insert(schema.entries)
    .values(
      WORDS.map((answer, i) => ({
        languageCode,
        clue: `E2E capital clue ${i}`,
        answer,
        answerNormalized: answer.toUpperCase(),
        length: answer.length,
        difficulty: 3,
        source: "seed",
      })),
    )
    .onConflictDoNothing();
}

/**
 * Dedicated e2e content. The `zz` language stays fully isolated from any real
 * question-library data; the `en` set exists only because the public generate
 * form builds from the site locale (no picker), so a UI-driven generate needs
 * clues there. Both are marked by the "E2E capital clue" prefix and inserted
 * with `onConflictDoNothing`, so an existing `en` library is left untouched.
 */
async function seedQuestionLibrary() {
  await db
    .insert(schema.languages)
    .values([
      { code: E2E_LANGUAGE_CODE, name: E2E_LANGUAGE_NAME },
      { code: E2E_UI_LANGUAGE_CODE, name: "English" },
    ])
    .onConflictDoNothing();

  await seedEntries(E2E_LANGUAGE_CODE);
  await seedEntries(E2E_UI_LANGUAGE_CODE);
}

/**
 * Re-seed the two fixed e2e accounts before every e2e run: delete them (and,
 * via cascade, their sessions/accounts) if left over from a prior run, then
 * recreate with known credentials. Scoped to exactly these two emails —
 * never touches any other data in the database this points at.
 */
async function main() {
  await db
    .delete(schema.user)
    .where(
      inArray(schema.user.email, [
        E2E_ADMIN_EMAIL,
        E2E_CLIENT_EMAIL,
        E2E_CLIENT2_EMAIL,
        E2E_SIGNUP_EMAIL,
      ]),
    );
  await seedQuestionLibrary();

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

  await provisioning.api.signUpEmail({
    body: { email: E2E_ADMIN_EMAIL, name: "E2E Admin", password: E2E_ADMIN_PASSWORD },
  });
  // The admin gate requires emailVerified; only trusted provisioning sets this.
  await db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(inArray(schema.user.email, [E2E_ADMIN_EMAIL]));

  await provisioning.api.signUpEmail({
    body: { email: E2E_CLIENT_EMAIL, name: "E2E Client", password: E2E_CLIENT_PASSWORD },
  });
  await provisioning.api.signUpEmail({
    body: { email: E2E_CLIENT2_EMAIL, name: "E2E Client 2", password: E2E_CLIENT2_PASSWORD },
  });

  console.log(
    `Seeded e2e accounts: ${E2E_ADMIN_EMAIL} (admin), ${E2E_CLIENT_EMAIL} + ${E2E_CLIENT2_EMAIL} (clients)`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
