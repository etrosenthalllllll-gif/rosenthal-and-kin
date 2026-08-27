// Server Component gate for every /portal page -- mirrors
// requireSession.ts's role for /ops, but redirects to /portal/expired
// (a static "ask your case handler for a new link" page) rather than a
// login form, since claimants never have a password to log in with.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Claimant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getClaimantByPortalSessionToken } from "@/lib/claimantPortalSessionStore";
import { PORTAL_SESSION_COOKIE_NAME } from "@/lib/claimantPortalAuth";

export async function requirePortalSession(): Promise<Claimant> {
  const token = cookies().get(PORTAL_SESSION_COOKIE_NAME)?.value;
  const claimant = token ? await getClaimantByPortalSessionToken(prisma, token) : null;
  if (!claimant) {
    redirect("/portal/expired");
  }
  return claimant;
}
