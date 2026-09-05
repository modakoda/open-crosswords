import { describe, expect, it } from "vitest";
import { difficultyRange } from "./difficulty";
import { DIFFICULTY_LEVELS } from "./validation/schemas";

describe("difficultyRange", () => {
  it("treats an unset level as any", () => {
    expect(difficultyRange()).toEqual({ min: 1, max: 5 });
    expect(difficultyRange("any")).toEqual(difficultyRange());
  });

  it("narrows easy and hard to opposite ends", () => {
    expect(difficultyRange("easy")).toEqual({ min: 1, max: 2 });
    expect(difficultyRange("hard")).toEqual({ min: 4, max: 5 });
  });

  it("keeps every level inside the stored 1..5 scale", () => {
    for (const level of DIFFICULTY_LEVELS) {
      const { min, max } = difficultyRange(level);
      expect(min).toBeGreaterThanOrEqual(1);
      expect(max).toBeLessThanOrEqual(5);
      expect(min).toBeLessThanOrEqual(max);
    }
  });

  it("covers the whole scale across easy, medium and hard", () => {
    const covered = new Set<number>();
    for (const level of ["easy", "medium", "hard"] as const) {
      const { min, max } = difficultyRange(level);
      for (let d = min; d <= max; d++) covered.add(d);
    }
    expect([...covered].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
