import { describe, expect, it, vi } from "vitest";
import { PUZZLE_SLUG_PATTERN } from "@/lib/puzzle-slug";
import { insertUniquePuzzle } from "./insert-unique";

function uniqueViolation() {
  return Object.assign(new Error("duplicate key value"), { code: "23505" });
}

describe("insertUniquePuzzle", () => {
  it("returns the inserted id with the slug it used", async () => {
    const insert = vi.fn(async () => "puzzle-id");
    const { id, slug } = await insertUniquePuzzle(insert);
    expect(id).toBe("puzzle-id");
    expect(slug).toMatch(PUZZLE_SLUG_PATTERN);
    expect(insert).toHaveBeenCalledWith(slug);
  });

  it("retries with a fresh slug after a unique violation", async () => {
    const insert = vi
      .fn<(slug: string) => Promise<string>>()
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce("puzzle-id");
    const { slug } = await insertUniquePuzzle(insert);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0]).not.toBe(slug);
    expect(insert.mock.calls[1][0]).toBe(slug);
  });

  it("gives up after the attempt budget", async () => {
    const insert = vi.fn(async () => {
      throw uniqueViolation();
    });
    await expect(insertUniquePuzzle(insert, 3)).rejects.toThrow("duplicate key");
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it("does not retry unrelated failures", async () => {
    const insert = vi.fn(async () => {
      throw new Error("connection lost");
    });
    await expect(insertUniquePuzzle(insert)).rejects.toThrow("connection lost");
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
