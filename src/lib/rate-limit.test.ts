import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits, clientKey, rateLimit } from "./rate-limit";

beforeEach(() => __resetRateLimits());

describe("rateLimit", () => {
  it("allows up to the limit then blocks within the window", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 60).ok).toBe(true);
    }
    const blocked = rateLimit("k", 3, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    rateLimit("k", 1, 1);
    expect(rateLimit("k", 1, 1).ok).toBe(false);
    vi.advanceTimersByTime(1100);
    expect(rateLimit("k", 1, 1).ok).toBe(true);
    vi.useRealTimers();
  });

  it("keys are independent", () => {
    rateLimit("a", 1, 60);
    expect(rateLimit("b", 1, 60).ok).toBe(true);
  });
});

describe("clientKey", () => {
  it("keys on the address header the deployment trusts", () => {
    const h = new Headers({ "x-vercel-forwarded-for": "5.6.7.8" });
    expect(clientKey(h, "gen")).toBe("gen:5.6.7.8");
  });

  it("ignores headers a caller can forge, so the key can't be rotated", () => {
    const h = new Headers({
      "x-forwarded-for": "9.9.9.9",
      "cf-connecting-ip": "8.8.8.8",
      "x-real-ip": "7.7.7.7",
    });
    // Only AUTH_IP_HEADER counts; the rest resolve to the same shared bucket.
    expect(clientKey(h, "gen")).toBe(clientKey(new Headers(), "gen"));
  });
});
