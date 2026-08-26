// DB-touching session wrapper around the pure primitives in session.ts.
// Untested by design (same split as db.ts/decisionQueue.ts's fetch half)
// -- the logic worth unit-testing (token generation, hashing, expiry) is
// in session.ts and has real tests there.

import type { PrismaClient, User } from "@prisma/client";
import { verifyPassword } from "./auth";
import {
  generateSessionToken,
  hashSessionToken,
  newSessionExpiry,
  isSessionExpired,
} from "./session";

/**
 * Verifies email+password against the User table. Returns null on any
 * failure (unknown email, wrong password, disabled account) -- never
 * distinguishes which, so a login form can't be used to enumerate valid
 * emails.
 */
export async function authenticateUser(
  db: PrismaClient,
  email: string,
  password: string
): Promise<User | null> {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.disabledAt) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return user;
}

/**
 * Creates a session row for an already-authenticated user and returns
 * the raw token to set as a cookie. The raw token is never stored --
 * only its hash, via hashSessionToken.
 */
export async function createSession(db: PrismaClient, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = newSessionExpiry();
  await db.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt },
  });
  return { token, expiresAt };
}

/**
 * Resolves a raw session-cookie token back to its User, or null if the
 * token is unknown, expired, or the account has since been disabled.
 * Does not distinguish these cases in its return value -- callers should
 * just treat null as "not authenticated."
 */
export async function getUserBySessionToken(db: PrismaClient, token: string): Promise<User | null> {
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (isSessionExpired(session.expiresAt)) return null;
  if (session.user.disabledAt) return null;
  return session.user;
}

export async function deleteSession(db: PrismaClient, token: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}
