import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteSession } from "@/lib/sessionStore";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { getPublicOrigin } from "@/lib/requestOrigin";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSession(prisma, token);
  }
  const response = NextResponse.redirect(new URL("/login", getPublicOrigin(req)), { status: 303 });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
