import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The server environment holds the connection string, the auth secret and the
 * API key, so a client component that imports it inlines them into the
 * JavaScript sent to every visitor. eslint.config.mjs bars the known client
 * paths, but a rule keyed to file globs can only cover the files that exist
 * when it is written, and it does not see `await import(...)`. This walks the
 * tree instead, so a client component added anywhere is checked. It catches a
 * direct reference; a module pulled in through a shared helper is not visible
 * here, which is why the lint rule stays as well.
 */
const src = resolve(import.meta.dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

const clientModules = sourceFiles(src)
  .map((path) => ({ path, text: readFileSync(path, "utf8") }))
  // "use client" is only a directive as the first statement of the file.
  .filter(({ text }) => /^\s*("use client"|'use client')/.test(text));

describe("client modules", () => {
  it("finds the files that ship to the browser", () => {
    // A walk that matched nothing would pass every assertion below.
    expect(clientModules.length).toBeGreaterThan(0);
  });

  it.each(clientModules.map(({ path }) => path))(
    "%s does not reach the server environment",
    (path) => {
      const text = clientModules.find((m) => m.path === path)!.text;
      expect(text).not.toMatch(/["'](@\/lib\/env\/server|[./]+\/env\/server)["']/);
    },
  );
});
