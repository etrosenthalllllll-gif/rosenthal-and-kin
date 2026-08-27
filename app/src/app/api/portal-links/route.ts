// Operator-triggered: generate a claimant portal access link. Returns
// the link directly in the HTML response body (never as a redirect
// query param) so the raw token never lands in a URL, browser history,
// or a server access log -- it only ever appears once, on this page.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/requireSession";
import { requirePermission } from "@/lib/auth";
import { createAccessLink } from "@/lib/claimantPortalSessionStore";
import { getPublicOrigin } from "@/lib/requestOrigin";

export async function POST(req: NextRequest) {
  const user = await requireSession();
  requirePermission(user.role, "SEND_COMMUNICATIONS");

  const form = await req.formData();
  const claimantId = String(form.get("claimantId") ?? "");
  const origin = getPublicOrigin(req);

  const claimant = await prisma.claimant.findUnique({ where: { id: claimantId } });
  if (!claimant) {
    return NextResponse.json({ error: "Claimant not found" }, { status: 404 });
  }

  const { token, expiresAt } = await createAccessLink(prisma, claimantId);
  // portal.rosenthalandkin.com isn't DNS/Render-configured yet (see
  // PLAN.md) -- the link below points at this same app's own origin
  // and still works today via the /portal/* paths directly. Once the
  // subdomain is live, links generated after that point will resolve
  // through it automatically since middleware.ts rewrites by hostname,
  // not by which URL this route happens to build.
  const portalUrl = new URL(`/portal/access/${token}`, origin).toString();

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Portal link generated</title>
<style>
  body{font-family:Inter,-apple-system,sans-serif;background:#ede3cb;color:#1c2b45;max-width:560px;margin:10vh auto;padding:0 20px;}
  .card{background:#fffdf6;border:1px solid #e2d7b8;border-radius:6px;padding:28px 24px;}
  .url{background:#f7f2e4;border:1px solid #cfc19b;border-radius:4px;padding:12px 14px;font-family:monospace;font-size:13px;word-break:break-all;margin:16px 0;}
  a.back{display:inline-block;margin-top:12px;color:#1c2b45;font-size:13px;}
</style></head>
<body>
  <div class="card">
    <h2 style="margin-top:0;">Portal link for ${claimant.id}</h2>
    <p>Copy this link and send it to the claimant yourself (no automated send is wired up yet). It expires ${expiresAt.toLocaleDateString(
      "en-US",
      { month: "long", day: "numeric", year: "numeric" }
    )}.</p>
    <div class="url">${portalUrl}</div>
    <a class="back" href="/ops/cases/${claimant.id}">&larr; Back to case</a>
  </div>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
