import { describe, expect, it } from "vitest";
import { z } from "zod";
import { clientEnv, envError, parseClientEnv, publicSchema, publicSource } from "./client";

describe("public environment", () => {
  it("declares only variables the browser may see", () => {
    // Every key here is inlined into the JavaScript sent to every visitor, so
    // the NEXT_PUBLIC_ prefix is the line between this file and ./server.ts.
    for (const key of Object.keys(publicSchema.shape)) {
      expect(key).toMatch(/^NEXT_PUBLIC_/);
    }
  });

  it("parses on import", () => {
    expect(clientEnv).toEqual(parseClientEnv({}));
  });

  it("reads every declared variable in the literal Next can substitute", () => {
    // The schema and the source object are edited by hand, one line each. A
    // variable declared but not read would silently take its default in the
    // browser while the server, which parses process.env wholesale, sees the
    // real value.
    expect(Object.keys(publicSource)).toEqual(
      expect.arrayContaining(Object.keys(publicSchema.shape)),
    );
  });

  it("ignores server variables that happen to be in scope", () => {
    // Client code reads its own literal source; a server value passing through
    // must not become part of the public environment.
    expect(parseClientEnv({ DATABASE_URL: "postgresql://u:p@h/db" })).not.toHaveProperty(
      "DATABASE_URL",
    );
  });
});

describe("envError", () => {
  it("lists every problem, naming variables but never their values", () => {
    const parsed = z
      .object({ A_SECRET: z.string().min(16), A_URL: z.url() })
      .safeParse({ A_SECRET: "too-short", A_URL: "nonsense" });
    if (parsed.success) throw new Error("expected the parse to fail");

    const message = envError(parsed.error).message;
    expect(message).toContain("A_SECRET");
    expect(message).toContain("A_URL");
    expect(message).not.toContain("too-short");
    expect(message).not.toContain("nonsense");
  });
});
