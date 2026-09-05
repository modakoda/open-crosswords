/**
 * Decorative page chrome — an aurora wash plus a faint crossword lattice,
 * painted once behind every route. Cosmetic only: hidden from assistive tech,
 * inert to pointer events, and dropped from print output.
 */
export function PageBackdrop() {
  return (
    <div
      aria-hidden
      className="app-backdrop no-print pointer-events-none fixed inset-0 z-0 overflow-hidden"
    />
  );
}
