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

  it("keeps the letters a language counts as its own", () => {
    expect(normalizeAnswer("žuvis", "lt")).toBe("ŽUVIS");
    expect(normalizeAnswer("Kražiai", "lt")).toBe("KRAŽIAI");
    expect(normalizeAnswer("ąčęėįšųūž", "lt")).toBe("ĄČĘĖĮŠŲŪŽ");
  });

  it("matches the language on its base subtag", () => {
    expect(normalizeAnswer("žuvis", "LT-lt")).toBe("ŽUVIS");
  });

  it("keeps them regardless of how the input is composed", () => {
    // Same word typed with a combining caron rather than a precomposed Ž.
    expect(normalizeAnswer("žuvis", "lt")).toBe("ŽUVIS");
  });

  it("still folds accents the language does not claim", () => {
    // É is not a Lithuanian letter, so it folds even in a Lithuanian answer.
    expect(normalizeAnswer("café", "lt")).toBe("CAFE");
  });

  it("folds for a language with no alphabet of its own", () => {
    expect(normalizeAnswer("žuvis", "en")).toBe("ZUVIS");
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

  it("counts accented letters once", () => {
    expect(isPlaceableAnswer("Ž".repeat(21))).toBe(true);
    expect(isPlaceableAnswer("Ž".repeat(22))).toBe(false);
  });

  it("rejects a language code that names an inherited property", () => {
    expect(normalizeAnswer("žuvis", "constructor")).toBe("ZUVIS");
  });
});
