import { describe, expect, it } from "vitest";
import { ORPCError } from "@orpc/client";

import { generateErrorMessage } from "./generate-error";
import { getMessages } from "./i18n";

const t = getMessages("lt").generateForm;

describe("generateErrorMessage", () => {
  it("translates each generation failure reason", () => {
    expect(
      generateErrorMessage(
        new ORPCError("UNPROCESSABLE_CONTENT", { data: { reason: "no-entries" } }),
        t,
      ),
    ).toBe(t.errorNoEntries);

    expect(
      generateErrorMessage(
        new ORPCError("UNPROCESSABLE_CONTENT", { data: { reason: "no-interlock" } }),
        t,
      ),
    ).toBe(t.errorNoInterlock);
  });

  it("translates rate limiting", () => {
    expect(generateErrorMessage(new ORPCError("TOO_MANY_REQUESTS"), t)).toBe(
      t.errorRateLimited,
    );
  });

  it("never leaks an English server message", () => {
    const english = "Need at least 4 enabled entries for this selection";
    const cases: unknown[] = [
      new ORPCError("INTERNAL_SERVER_ERROR", { message: english }),
      new ORPCError("UNPROCESSABLE_CONTENT", { message: english }),
      new Error(english),
      "boom",
    ];
    for (const err of cases) {
      expect(generateErrorMessage(err, t)).not.toContain("Need at least");
    }
    expect(generateErrorMessage(new Error(english), t)).toBe(t.errorUnknown);
  });
});
