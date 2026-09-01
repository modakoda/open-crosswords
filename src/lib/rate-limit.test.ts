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
  it("uses the last (proxy-appended) x-forwarded-for hop, not the client-controlled first", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientKey(h, "gen")).toBe("gen:5.6.7.8");
  });

  it("prefers a trusted platform header over x-forwarded-for", () => {
    const h = new Headers({
      "x-forwarded-for": "9.9.9.9",
      "x-vercel-forwarded-for": "5.6.7.8",
    });
    expect(clientKey(h, "gen")).toBe("gen:5.6.7.8");
  });

  it("falls back to a fixed key without proxy headers", () => {
    expect(clientKey(new Headers(), "gen")).toBe("gen:local");
  });
});
