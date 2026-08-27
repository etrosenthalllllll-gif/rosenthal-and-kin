import { describe, it, expect } from "vitest";
import {
  generatePortalToken,
  hashPortalToken,
  newPortalSessionExpiry,
  newAccessLinkExpiry,
  isPortalTokenExpired,
  PORTAL_SESSION_DURATION_MS,
  ACCESS_LINK_DURATION_MS,
} from "./claimantPortalAuth";

describe("portal token primitives", () => {
  it("generates a high-entropy, non-repeating token", () => {
    const a = generatePortalToken();
    const b = generatePortalToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes deterministically -- same input, same hash", () => {
    const token = generatePortalToken();
    expect(hashPortalToken(token)).toBe(hashPortalToken(token));
  });

  it("never stores the raw token in its hash", () => {
    const token = "a-known-token-value";
    expect(hashPortalToken(token)).not.toBe(token);
  });

  it("access links outlive portal sessions -- a claimant shouldn't lose access just because a session cookie expired", () => {
    expect(ACCESS_LINK_DURATION_MS).toBeGreaterThan(PORTAL_SESSION_DURATION_MS);
  });

  it("computes expiry durations correctly", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(newPortalSessionExpiry(now).getTime() - now.getTime()).toBe(PORTAL_SESSION_DURATION_MS);
    expect(newAccessLinkExpiry(now).getTime() - now.getTime()).toBe(ACCESS_LINK_DURATION_MS);
  });

  it("correctly identifies expired vs. valid tokens", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const past = new Date("2025-12-31T00:00:00Z");
    const future = new Date("2026-02-01T00:00:00Z");
    expect(isPortalTokenExpired(past, now)).toBe(true);
    expect(isPortalTokenExpired(future, now)).toBe(false);
  });
});
