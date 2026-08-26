import { describe, it, expect } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  newSessionExpiry,
  isSessionExpired,
  SESSION_DURATION_MS,
} from "./session";

describe("generateSessionToken", () => {
  it("generates a long, high-entropy hex token", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never generates the same token twice in practice", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
  });
});

describe("hashSessionToken", () => {
  it("is deterministic for the same input", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("never returns the raw token", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("produces different hashes for different tokens", () => {
    expect(hashSessionToken("a")).not.toBe(hashSessionToken("b"));
  });
});

describe("session expiry", () => {
  it("newSessionExpiry is SESSION_DURATION_MS in the future", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiry = newSessionExpiry(now);
    expect(expiry.getTime() - now.getTime()).toBe(SESSION_DURATION_MS);
  });

  it("isSessionExpired is false before the expiry time", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiry = newSessionExpiry(now);
    const justBefore = new Date(expiry.getTime() - 1);
    expect(isSessionExpired(expiry, justBefore)).toBe(false);
  });

  it("isSessionExpired is true at or after the expiry time", () => {
    const expiry = new Date("2026-01-01T00:00:00.000Z");
    expect(isSessionExpired(expiry, expiry)).toBe(true);
    expect(isSessionExpired(expiry, new Date(expiry.getTime() + 1))).toBe(true);
  });
});
