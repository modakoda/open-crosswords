import { test as base } from "@playwright/test";

/**
 * Shared address space (RFC 6598) — never a public client, and disjoint from
 * the documentation addresses the rate-limit specs and `global-setup` pin.
 * The worker index is an octet of its own, so two workers can never hand out
 * the same address even though the counter is per process.
 */
let nextAddress = 0;
const address = (worker: number) =>
  `100.64.${worker % 256}.${(nextAddress++ % 254) + 1}`;

/**
 * The suite's `test`, with a distinct client address per test.
 *
 * Every limit in the app is keyed to the caller's address, and a request that
 * carries none falls into one bucket shared by everybody (see
 * `src/lib/client-ip.ts`). A browser sends no such header on its own, so the
 * whole run would otherwise share a single counter: better-auth allows 20
 * session reads a minute, the root layout's header reads the session on every
 * page, and past that point `useSession` starts coming back empty — a signed-in
 * client silently renders as signed out, and whichever test happens to cross
 * the line fails for its neighbours' reasons.
 *
 * One address per test gives each its own counters, which is what the limits
 * mean for one visitor in production anyway. A test that is *about* a limit
 * still states its own address per request, which overrides this.
 *
 * A context built by hand (`browser.newContext`) does not inherit this — take
 * the `extraHTTPHeaders` fixture and pass it along, as authorization.spec.ts
 * does.
 */
export const test = base.extend({
  // Playwright's second argument is the value provider. Named `provide` rather
  // than the conventional `use`, which the React hooks lint rule reads as a
  // hook call in a plain function.
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide, testInfo) => {
    await provide({
      ...extraHTTPHeaders,
      "x-vercel-forwarded-for": address(testInfo.workerIndex),
    });
  },
});

export { expect } from "@playwright/test";
