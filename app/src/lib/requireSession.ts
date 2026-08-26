// Server Component gate: call at the top of any page under /ops (or
// anywhere else operator-only) to redirect unauthenticated visitors to
// /login. This is the piece that was missing since /ops shipped in
// P1-4 -- that page's own comment flagged it loudly rather than quietly
// shipping an unauthenticated case-management view.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserBySessionToken } from "@/lib/sessionStore";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function requireSession(): Promise<User> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await getUserBySessionToken(prisma, token) : null;
  if (!user) {
    redirect("/login");
  }
  return user;
}
