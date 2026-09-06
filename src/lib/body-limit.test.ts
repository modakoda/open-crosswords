import { describe, expect, it } from "vitest";
import { exceedsBodyLimit } from "./body-limit";

const declaring = (length: string | null) =>
  new Request("https://example.test/", {
    method: "POST",
    headers: length === null ? {} : { "content-length": length },
  });

describe("exceedsBodyLimit", () => {
  it("allows a body at the limit and refuses one over it", () => {
    expect(exceedsBodyLimit(declaring("100"), 100)).toBe(false);
    expect(exceedsBodyLimit(declaring("101"), 100)).toBe(true);
  });

  it("allows a request that declares no length", () => {
    // A chunked request carries no Content-Length, which is why this cap is
    // only ever a soft one: the schema's own limit still has to catch it.
    expect(exceedsBodyLimit(declaring(null), 100)).toBe(false);
  });

  it("allows a length it cannot read rather than refusing on it", () => {
    expect(exceedsBodyLimit(declaring("not-a-number"), 100)).toBe(false);
  });
});
