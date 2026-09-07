/** Fixed, e2e-only accounts. Re-seeded (deleted + recreated) before every e2e run. */
export const E2E_ADMIN_EMAIL = "e2e-admin@example.com";
export const E2E_ADMIN_PASSWORD = "e2e-admin-password-123";
export const E2E_CLIENT_EMAIL = "e2e-client@example.com";
export const E2E_CLIENT_PASSWORD = "e2e-client-password-123";

/** A second, distinct client account — used only for cross-user (IDOR) checks. */
export const E2E_CLIENT2_EMAIL = "e2e-client-2@example.com";
export const E2E_CLIENT2_PASSWORD = "e2e-client-2-password-123";

/** Not pre-created — the sign-up spec creates this account itself via the UI. */
export const E2E_SIGNUP_EMAIL = "e2e-signup-test@example.com";
export const E2E_SIGNUP_PASSWORD = "e2e-signup-password-123";

/**
 * In ADMIN_EMAILS (see playwright.config.ts) but never provisioned by
 * `create-admin`, so nothing ever marks it verified. Self-serve sign-up must
 * not be able to claim it: the allow-list is only half the admin check, and
 * `getAdmin` fails closed on the unverified half. Created through the UI by
 * auth-session.spec.ts, and deleted by the seed like the other e2e accounts.
 */
export const E2E_UNPROVISIONED_ADMIN_EMAIL = "e2e-unprovisioned-admin@example.com";

/**
 * The port the suite builds and serves on. Overridable so a run can sidestep a
 * dev server already holding the default — the two would otherwise share a
 * port but not an environment (`playwright.config.ts` sets its own
 * `ADMIN_EMAILS`), and Playwright would silently reuse the wrong one.
 */
const port = Number(process.env.E2E_PORT);
export const E2E_PORT = Number.isInteger(port) && port > 0 ? port : 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** Dedicated content-library language, isolated from any real seeded data. */
export const E2E_LANGUAGE_CODE = "zz";
export const E2E_LANGUAGE_NAME = "E2E Test Language";

/**
 * A second isolated language, so a spec can move an entry between languages
 * without ever pushing an e2e row into the real `en` library.
 */
export const E2E_ALT_LANGUAGE_CODE = "zy";
export const E2E_ALT_LANGUAGE_NAME = "E2E Alt Language";

/**
 * The public generate form has no language picker — it always builds from the
 * site locale, which is `en` for the browser locale Playwright runs with. So
 * the UI-driven specs need clues under `en` as well as the isolated `zz` set.
 */
export const E2E_UI_LANGUAGE_CODE = "en";

/**
 * A public puzzle URL, whose slug is four lowercase words plus an eight-digit
 * number (`src/lib/puzzle-slug.ts`). Kept here so a change to the slug format
 * lands in one place rather than in every spec that waits for a generate.
 */
export const PUZZLE_URL_PATTERN = /\/public\/puzzles\/[a-z]+(-[a-z]+){3}-\d{8}$/;

/**
 * The admin views, each its own route. Mirrors `ADMIN_VIEW_SEGMENTS` in
 * `src/components/admin/views.ts` — stated here rather than imported, so the
 * specs assert the routes the app is expected to expose rather than whatever
 * it currently lists.
 */
export const ADMIN_VIEWS = [
  "entries",
  "puzzles",
  "languages",
  "users",
  "import",
  "ai",
] as const;
