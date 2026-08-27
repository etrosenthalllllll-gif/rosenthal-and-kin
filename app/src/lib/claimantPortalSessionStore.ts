// DB-touching wrapper around claimantPortalAuth.ts's pure primitives.
// Untested by design -- same split as sessionStore.ts (the logic worth
// unit-testing is in claimantPortalAuth.ts and has real tests there).

import type { PrismaClient, Claimant } from "@prisma/client";
import {
  generatePortalToken,
  hashPortalToken,
  newPortalSessionExpiry,
  newAccessLinkExpiry,
  isPortalTokenExpired,
} from "./claimantPortalAuth";

/**
 * Generates a new access link for a claimant -- the URL an operator
 * copies and sends manually today (no outbound provider is wired yet;
 * see PLAN.md P3-3/P3-9), and that a future automated outreach workflow
 * would send on its own once one exists. Does not invalidate any prior
 * link -- multiple valid links for one claimant is fine (an operator
 * regenerating one doesn't strand whichever copy the claimant already
 * has in their inbox).
 */
export async function createAccessLink(
  db: PrismaClient,
  claimantId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generatePortalToken();
  const expiresAt = newAccessLinkExpiry();
  await db.claimantAccessLink.create({
    data: { claimantId, tokenHash: hashPortalToken(token), expiresAt },
  });
  return { token, expiresAt };
}

/**
 * Resolves a raw access-link token to its Claimant, or null if unknown/
 * expired. Records lastUsedAt on success (informational only -- doesn't
 * affect validity) and immediately establishes a real portal session so
 * the claimant isn't re-validating the long-lived link on every request.
 */
export async function consumeAccessLink(
  db: PrismaClient,
  token: string
): Promise<{ claimant: Claimant; sessionToken: string; sessionExpiresAt: Date } | null> {
  const link = await db.claimantAccessLink.findUnique({
    where: { tokenHash: hashPortalToken(token) },
    include: { claimant: true },
  });
  if (!link || isPortalTokenExpired(link.expiresAt)) return null;

  await db.claimantAccessLink.update({
    where: { id: link.id },
    data: { lastUsedAt: new Date() },
  });

  const sessionToken = generatePortalToken();
  const sessionExpiresAt = newPortalSessionExpiry();
  await db.claimantPortalSession.create({
    data: { claimantId: link.claimantId, tokenHash: hashPortalToken(sessionToken), expiresAt: sessionExpiresAt },
  });

  return { claimant: link.claimant, sessionToken, sessionExpiresAt };
}

export async function getClaimantByPortalSessionToken(
  db: PrismaClient,
  token: string
): Promise<Claimant | null> {
  const session = await db.claimantPortalSession.findUnique({
    where: { tokenHash: hashPortalToken(token) },
    include: { claimant: true },
  });
  if (!session) return null;
  if (isPortalTokenExpired(session.expiresAt)) return null;
  return session.claimant;
}

export async function deletePortalSession(db: PrismaClient, token: string): Promise<void> {
  await db.claimantPortalSession.deleteMany({ where: { tokenHash: hashPortalToken(token) } });
}
