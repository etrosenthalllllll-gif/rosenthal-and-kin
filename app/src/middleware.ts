// Serves portal.rosenthalandkin.com from this same app's /portal/*
// routes, transparently -- no second deployed service needed. Requests
// to the portal subdomain get rewritten so "/" resolves to "/portal"
// and "/documents" resolves to "/portal/documents", etc.
//
// This only takes effect once portal.rosenthalandkin.com actually
// points at this Render service (DNS CNAME + a custom domain added in
// the Render dashboard) -- neither is configured yet (see PLAN.md).
// Until then, the portal is still fully reachable at
// https://rosenthal-and-kin-app.onrender.com/portal.
import { NextRequest, NextResponse } from "next/server";

const PORTAL_HOST_PREFIX = "portal.";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const { pathname } = req.nextUrl;

  if (host.startsWith(PORTAL_HOST_PREFIX)) {
    const alreadyPortalScoped =
      pathname.startsWith("/portal") || pathname.startsWith("/api/portal") || pathname === "/api/health";
    if (!alreadyPortalScoped) {
      const url = req.nextUrl.clone();
      url.pathname = `/portal${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
