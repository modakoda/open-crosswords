import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { E2E_LANGUAGE_CODE } from "./constants";

/** A uuid that matches no row — these calls must be refused before any lookup. */
const NO_SUCH_ID = "00000000-0000-4000-8000-000000000000";

/**
 * Every admin-gated procedure, with a payload its schema accepts.
 *
 * The payloads are valid on purpose: oRPC would answer 422 for a malformed one,
 * and a test that passes on the wrong status proves nothing about the gate.
 * Ids point at nothing, so a procedure that somehow ran would still change no
 * data — every one of these must be refused before it looks anything up.
 */
export const ADMIN_PROCEDURES: { path: string; input: unknown }[] = [
  { path: "admin/entries/list", input: { limit: 20, offset: 0 } },
  {
    path: "admin/entries/create",
    input: {
      languageCode: E2E_LANGUAGE_CODE,
      clue: "should never be created",
      answer: "NOPE",
    },
  },
  {
    path: "admin/entries/update",
    input: { id: NO_SUCH_ID, patch: { enabled: false } },
  },
  { path: "admin/entries/delete", input: { id: NO_SUCH_ID } },
  { path: "admin/entries/deleteMany", input: { ids: [NO_SUCH_ID] } },
  {
    path: "admin/entries/import",
    input: {
      languageCode: E2E_LANGUAGE_CODE,
      format: "json",
      text: JSON.stringify([{ clue: "should never be imported", answer: "NOPE" }]),
      createMissingCategories: true,
    },
  },
  {
    path: "admin/entries/aiDraft",
    input: { languageCode: E2E_LANGUAGE_CODE, topic: "should never be drafted", count: 1 },
  },
  { path: "admin/languages/create", input: { code: "qq", name: "Should never exist" } },
  {
    path: "admin/categories/create",
    input: { languageCode: E2E_LANGUAGE_CODE, name: "Should never exist" },
  },
  { path: "admin/puzzles/list", input: { limit: 20, offset: 0 } },
  {
    path: "admin/puzzles/rename",
    input: { id: NO_SUCH_ID, title: "should never be renamed" },
  },
  { path: "admin/puzzles/delete", input: { id: NO_SUCH_ID } },
];

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * How many procedures the routers actually define, counted from their source.
 *
 * The list above is written by hand, so on its own it would quietly stop
 * covering the router the day someone adds a procedure. This is the tripwire
 * for that: an added `adminProcedure` fails the count until it is listed here
 * too, which is the point at which its gate gets an assertion.
 */
export function countAdminProceduresInSource() {
  const routers = ["admin.ts", "admin-puzzles.ts"].map((file) =>
    readFileSync(path.join(dirname, "../src/lib/orpc/routers", file), "utf8"),
  );
  return routers.reduce(
    (total, src) => total + (src.match(/=\s*adminProcedure\b/g) ?? []).length,
    0,
  );
}
