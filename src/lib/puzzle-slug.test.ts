import { describe, expect, it } from "vitest";
import { generatePuzzleSlug, PUZZLE_SLUG_PATTERN } from "./puzzle-slug";
import { SLUG_ADJECTIVES, SLUG_NOUNS } from "./slug-words";
import { puzzleSlugSchema } from "./validation/schemas";

describe("generatePuzzleSlug", () => {
  it("produces four words followed by an eight-digit number", () => {
    for (let i = 0; i < 200; i++) {
      const slug = generatePuzzleSlug();
      expect(slug).toMatch(PUZZLE_SLUG_PATTERN);
      const parts = slug.split("-");
      expect(SLUG_ADJECTIVES).toContain(parts[0]);
      expect(SLUG_ADJECTIVES).toContain(parts[1]);
      expect(SLUG_NOUNS).toContain(parts[2]);
      expect(SLUG_NOUNS).toContain(parts[3]);
      expect(Number(parts[4])).toBeGreaterThanOrEqual(10_000_000);
      expect(Number(parts[4])).toBeLessThanOrEqual(99_999_999);
    }
  });

  it("passes the public slug schema and stays within its length cap", () => {
    for (let i = 0; i < 200; i++) {
      const slug = generatePuzzleSlug();
      expect(puzzleSlugSchema.safeParse(slug).success).toBe(true);
    }
  });

  it("does not repeat itself across many draws", () => {
    const slugs = new Set(Array.from({ length: 500 }, generatePuzzleSlug));
    expect(slugs.size).toBe(500);
  });
});

describe("slug word pools", () => {
  it("hold unique lowercase words in the advertised sizes", () => {
    expect(SLUG_ADJECTIVES.length).toBe(128);
    expect(SLUG_NOUNS.length).toBe(256);
    expect(new Set(SLUG_ADJECTIVES).size).toBe(SLUG_ADJECTIVES.length);
    expect(new Set(SLUG_NOUNS).size).toBe(SLUG_NOUNS.length);
    for (const word of [...SLUG_ADJECTIVES, ...SLUG_NOUNS]) {
      expect(word).toMatch(/^[a-z]{2,12}$/);
    }
  });
});
