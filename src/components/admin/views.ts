/**
 * The admin views, as routes. Kept out of `AdminNav` (a client module) so the
 * server-rendered redirect at `/admin/dashboard` can import the real values
 * rather than client-reference stubs.
 */
export const ADMIN_BASE_PATH = "/admin/dashboard";

export const ADMIN_VIEW_SEGMENTS = [
  "entries",
  "puzzles",
  "languages",
  "users",
  "import",
  "ai",
] as const;

export type AdminViewSegment = (typeof ADMIN_VIEW_SEGMENTS)[number];

/** `/admin/dashboard` redirects here. */
export const DEFAULT_ADMIN_VIEW: AdminViewSegment = "entries";
