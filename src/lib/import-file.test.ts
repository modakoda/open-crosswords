import { describe, expect, it } from "vitest";

import {
  ImportFileError,
  MAX_IMPORT_FILE_BYTES,
  formatFromFileName,
  readImportFile,
} from "./import-file";

function file(name: string, content: string): File {
  return new File([content], name, { type: "text/plain" });
}

describe("formatFromFileName", () => {
  it("recognises json and csv, case-insensitively", () => {
    expect(formatFromFileName("entries.json")).toBe("json");
    expect(formatFromFileName("ENTRIES.JSON")).toBe("json");
    expect(formatFromFileName("entries.csv")).toBe("csv");
    expect(formatFromFileName("my.entries.backup.json")).toBe("json");
  });

  it("rejects anything else", () => {
    expect(formatFromFileName("entries.txt")).toBeNull();
    expect(formatFromFileName("entries")).toBeNull();
    expect(formatFromFileName("entries.json.exe")).toBeNull();
  });
});

describe("readImportFile", () => {
  it("returns the text and format of a json file", async () => {
    const content = '[{"clue":"Capital of France","answer":"Paris"}]';
    await expect(readImportFile(file("entries.json", content))).resolves.toEqual({
      text: content,
      format: "json",
    });
  });

  it("returns csv format for a csv file", async () => {
    const content = "clue,answer\nFrozen water,Ice";
    await expect(readImportFile(file("entries.csv", content))).resolves.toEqual({
      text: content,
      format: "csv",
    });
  });

  it("rejects an unsupported extension", async () => {
    await expect(readImportFile(file("entries.txt", "[]"))).rejects.toThrow(
      ImportFileError,
    );
  });

  it("rejects an empty file", async () => {
    await expect(readImportFile(file("entries.json", "   \n"))).rejects.toThrow(
      "That file is empty",
    );
  });

  it("accepts a file larger than one request's limit, for chunking", async () => {
    const content = "x".repeat(600_000);
    await expect(readImportFile(file("entries.json", content))).resolves.toMatchObject({
      format: "json",
    });
  });

  it("rejects a file past the browser-side ceiling", async () => {
    const big = file("entries.json", "");
    Object.defineProperty(big, "size", { value: MAX_IMPORT_FILE_BYTES + 1 });
    await expect(readImportFile(big)).rejects.toThrow("too large");
  });
});
