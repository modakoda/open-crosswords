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

/**
 * The views that get the shell's working-language picker: their whole action
 * is scoped to one language and they have no listing of their own to filter.
 * Entries and puzzles carry a language filter in their own toolbar, and the
 * languages view *is* the list of languages, so showing the picker on any of
 * them would be two controls for one thing.
 */
export const WORKING_LANGUAGE_VIEWS: readonly AdminViewSegment[] = [
  "import",
  "ai",
];

export function usesWorkingLanguagePicker(pathname: string): boolean {
  return WORKING_LANGUAGE_VIEWS.some(
    (segment) => pathname === `${ADMIN_BASE_PATH}/${segment}`,
  );
}
