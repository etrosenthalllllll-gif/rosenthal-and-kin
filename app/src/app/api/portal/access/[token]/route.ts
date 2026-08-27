// Claimant clicks their access link -> this establishes a real portal
// session cookie and redirects into the portal. No password, no form --
// doc 05's "secure claimant links."
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeAccessLink } from "@/lib/claimantPortalSessionStore";
import { PORTAL_SESSION_COOKIE_NAME } from "@/lib/claimantPortalAuth";
import { getPublicOrigin } from "@/lib/requestOrigin";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const origin = getPublicOrigin(req);
  const result = await consumeAccessLink(prisma, params.token);

  if (!result) {
    return NextResponse.redirect(new URL("/portal/expired", origin), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/portal", origin), { status: 303 });
  response.cookies.set(PORTAL_SESSION_COOKIE_NAME, result.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: result.sessionExpiresAt,
  });
  return response;
}
