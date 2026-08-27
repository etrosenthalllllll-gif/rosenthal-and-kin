import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deletePortalSession } from "@/lib/claimantPortalSessionStore";
import { PORTAL_SESSION_COOKIE_NAME } from "@/lib/claimantPortalAuth";
import { getPublicOrigin } from "@/lib/requestOrigin";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(PORTAL_SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deletePortalSession(prisma, token);
  }
  const response = NextResponse.redirect(new URL("/portal/expired", getPublicOrigin(req)), { status: 303 });
  response.cookies.delete(PORTAL_SESSION_COOKIE_NAME);
  return response;
}
