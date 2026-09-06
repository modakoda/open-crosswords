import { describe, expect, it } from "vitest";

import {
  isKnownDevice,
  withKnownDevice,
  KNOWN_DEVICE_COOKIE,
} from "./known-device";

const A = "alice@example.com";
const B = "bob@example.com";

describe("known device cookie", () => {
  it("vouches only for the account it was issued for", () => {
    const cookie = withKnownDevice(null, A);
    expect(isKnownDevice(cookie, A)).toBe(true);
    expect(isKnownDevice(cookie, B)).toBe(false);
  });

  it("treats a missing or unreadable cookie as unknown", () => {
    // better-call returns false for a cookie whose signature doesn't verify.
    expect(isKnownDevice(false, A)).toBe(false);
    expect(isKnownDevice(null, A)).toBe(false);
    expect(isKnownDevice("", A)).toBe(false);
  });

  it("remembers several accounts on a shared browser", () => {
    const cookie = withKnownDevice(withKnownDevice(null, A), B);
    expect(isKnownDevice(cookie, A)).toBe(true);
    expect(isKnownDevice(cookie, B)).toBe(true);
  });

  it("forgets the oldest account rather than growing without bound", () => {
    let cookie = withKnownDevice(null, A);
    for (let i = 0; i < 5; i++) cookie = withKnownDevice(cookie, `n${i}@example.com`);
    expect(isKnownDevice(cookie, A)).toBe(false);
    expect(cookie.split(".")).toHaveLength(5);
  });

  it("stores digests, not addresses", () => {
    expect(withKnownDevice(null, A)).not.toContain("alice");
  });

  it("names the cookie inside the app's own namespace", () => {
    // better-auth's cookiePrefix does not reach a cookie we name ourselves, so
    // the prefix has to be written out here.
    expect(KNOWN_DEVICE_COOKIE).toBe("open-crosswords.known_device");
  });
});
