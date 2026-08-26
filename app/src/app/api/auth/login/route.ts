// Login endpoint -- closes the P0-6 gap flagged loudly in /ops's own
// comments ("no auth/session gate exists yet"). Accepts a plain HTML
// form POST (email/password), verifies against the User table, and sets
// an httpOnly session cookie on success.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateUser, createSession } from "@/lib/sessionStore";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { getPublicOrigin } from "@/lib/requestOrigin";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const origin = getPublicOrigin(req);

  const user = await authenticateUser(prisma, email, password);
  if (!user) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, { status: 303 });
  }

  const { token, expiresAt } = await createSession(prisma, user.id);

  const response = NextResponse.redirect(new URL("/ops", origin), { status: 303 });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return response;
}
