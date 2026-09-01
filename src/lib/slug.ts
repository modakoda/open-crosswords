/** Lowercase, ASCII-fold, hyphenate — for category slugs and the like. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
