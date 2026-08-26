// Resolves the public-facing origin for building an absolute redirect
// URL inside a route handler. Render (and most reverse proxies) forward
// the original host/protocol via X-Forwarded-Host/X-Forwarded-Proto, but
// the request as seen by the Node process itself reports the internal
// bind address -- `new URL(path, req.url)` silently produces
// `http://localhost:10000/...` instead of the real public URL, which is
// invisible in local dev (no proxy in front) and only breaks once
// deployed. Found for real: login redirected to a broken localhost URL
// on the live Render deploy the first time this route ran there.
import type { NextRequest } from "next/server";

export function getPublicOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }
  return req.nextUrl.origin;
}
