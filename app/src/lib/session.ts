// Session token primitives — closes the P0-6 gap: auth.ts built the
// permission-check primitive, this is the login/session half that was
// still missing ("the login/session endpoint itself isn't wired up").
//
// Pure logic only (fully unit-tested); the DB-touching wrapper lives in
// sessionStore.ts, same split as every other module here (audit.ts,
// decisionQueue.ts, trackerImport.ts).

import { randomBytes, createHash } from "crypto";

export const SESSION_COOKIE_NAME = "rk_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generates a high-entropy session token. This is the value sent to the
 * browser as a cookie -- never persisted anywhere in plaintext.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hashes a session token for storage/lookup. SHA-256 (not bcrypt) is
 * correct here, unlike passwords: this is a 256-bit random value with no
 * guessable structure, so a slow KDF buys nothing and only adds latency
 * to every authenticated request.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_DURATION_MS);
}

export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
