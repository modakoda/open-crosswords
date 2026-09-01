import { describe, expect, it } from "vitest";
import { isPlaceableAnswer, normalizeAnswer } from "./normalize";

describe("normalizeAnswer", () => {
  it("uppercases and strips spaces/punctuation", () => {
    expect(normalizeAnswer("New York!")).toBe("NEWYORK");
    expect(normalizeAnswer("rock 'n' roll")).toBe("ROCKNROLL");
  });

  it("folds Latin diacritics to base letters", () => {
    expect(normalizeAnswer("Kražiai")).toBe("KRAZIAI");
    expect(normalizeAnswer("café")).toBe("CAFE");
    expect(normalizeAnswer("jalapeño")).toBe("JALAPENO");
  });

  it("drops digits", () => {
    expect(normalizeAnswer("area 51")).toBe("AREA");
  });

  it("keeps non-Latin letters", () => {
    expect(normalizeAnswer("Ελλάδα")).toBe("ΕΛΛΑΔΑ");
  });
});

describe("isPlaceableAnswer", () => {
  it("rejects too-short and too-long", () => {
    expect(isPlaceableAnswer("A")).toBe(false);
    expect(isPlaceableAnswer("AB")).toBe(true);
    expect(isPlaceableAnswer("A".repeat(22))).toBe(false);
  });
});
