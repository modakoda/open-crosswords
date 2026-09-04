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

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** Dedicated content-library language, isolated from any real seeded data. */
export const E2E_LANGUAGE_CODE = "zz";
export const E2E_LANGUAGE_NAME = "E2E Test Language";
