import { describe, expect, it } from "vitest";
import { paperToGrid } from "./paper";

describe("paperToGrid", () => {
  it("returns a sane square bound for every supported paper size", () => {
    for (const size of ["a4", "a5", "letter", "legal"] as const) {
      for (const o of ["portrait", "landscape"] as const) {
        const { maxSize, targetWords } = paperToGrid(size, o);
        expect(maxSize).toBeGreaterThanOrEqual(9);
        expect(maxSize).toBeLessThanOrEqual(23);
        expect(targetWords).toBeGreaterThan(maxSize);
      }
    }
  });

  it("gives A5 a smaller grid than A4", () => {
    expect(paperToGrid("a5", "portrait").maxSize).toBeLessThan(
      paperToGrid("a4", "portrait").maxSize,
    );
  });

  it("keeps legal at least as tall as letter in portrait", () => {
    expect(paperToGrid("legal", "portrait").maxSize).toBeGreaterThanOrEqual(
      paperToGrid("letter", "portrait").maxSize,
    );
  });
});
