// Claimant portal auth primitives -- doc 05's "secure claimant links."
// A claimant never gets a password: an operator (or eventually an
// automated outreach workflow) generates a link, the claimant clicks
// it, and that establishes a portal session cookie. Two token kinds,
// same token-generation/hashing discipline as session.ts:
//
// - Access link: long-lived, operator-generated, sent to the claimant.
//   Clicking it establishes a session; it can be reused if the session
//   expires (a claimant losing a cookie shouldn't mean losing access to
//   their own case), so it is NOT single-use, only expiry-bounded.
// - Portal session: short-lived, cookie-backed, exactly parallel to the
//   operator Session model.
//
// Pure logic only, fully unit-tested; the DB-touching wrapper lives in
// claimantPortalSessionStore.ts, same split as session.ts/sessionStore.ts.

import { randomBytes, createHash } from "crypto";

export const PORTAL_SESSION_COOKIE_NAME = "rk_portal_session";
export const PORTAL_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// Access links live much longer than a session -- they're the thing a
// claimant might come back to weeks later after their session cookie
// expired, not something that should force a fresh one from an
// operator every time.
export const ACCESS_LINK_DURATION_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

export function generatePortalToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPortalToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newPortalSessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + PORTAL_SESSION_DURATION_MS);
}

export function newAccessLinkExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + ACCESS_LINK_DURATION_MS);
}

export function isPortalTokenExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
