import { describe, expect, it } from "vitest";
import { makeRng, shuffle } from "./rng";

describe("makeRng", () => {
  it("is deterministic for a given seed", () => {
    const a = makeRng("seed-1");
    const b = makeRng("seed-1");
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("differs across seeds", () => {
    const a = makeRng("seed-1")();
    const b = makeRng("seed-2")();
    expect(a).not.toBe(b);
  });

  it("stays within [0, 1)", () => {
    const r = makeRng("x");
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  it("keeps the same members and is seed-deterministic", () => {
    const base = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = shuffle([...base], makeRng("s"));
    const s2 = shuffle([...base], makeRng("s"));
    expect(s1).toEqual(s2);
    expect([...s1].sort((a, b) => a - b)).toEqual(base);
  });
});
