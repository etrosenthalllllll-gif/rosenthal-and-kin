// Applies one operator action (Approve/Reject/Revise/Escalate/etc.) to
// one Decision -- the first real wiring of decisionWorkflow.ts's logic
// to an actual UI control (doc 02 section 6). Plain HTML form POST, no
// client JS needed -- same pattern as /api/auth/login.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/requireSession";
import { requirePermission, PermissionDeniedError } from "@/lib/auth";
import { getDecisionTypeConfig } from "@/lib/decisionTypes";
import { decideOnDecision, DecisionNotFoundError } from "@/lib/decisionActionHandler";
import { MissingRequiredCommentError, UnavailableActionError } from "@/lib/decisionWorkflow";
import { InvalidDecisionTransitionError } from "@/lib/decisionStatus";
import { getPublicOrigin } from "@/lib/requestOrigin";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const reasonRaw = form.get("reason");
  const reason = reasonRaw ? String(reasonRaw) : undefined;
  const returnTo = String(form.get("returnTo") ?? "/ops");
  const origin = getPublicOrigin(req);

  const decision = await prisma.decision.findUnique({ where: { id: params.id } });
  if (!decision) {
    return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  }

  // High-consequence decision types (filing, financial distribution,
  // case closure) need the stricter permission tier in addition to the
  // routine one -- doc 02 section 19's "confirmation step" applied as
  // an actual authorization check, not just a UI dialog.
  const config = getDecisionTypeConfig(decision.decisionType);
  try {
    requirePermission(user.role, "DECIDE_ROUTINE_DECISIONS");
    if (config.highConsequence) {
      requirePermission(user.role, "DECIDE_HIGH_CONSEQUENCE_DECISIONS");
    }
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      const url = new URL(returnTo, origin);
      url.searchParams.set("actionError", "permission");
      return NextResponse.redirect(url, { status: 303 });
    }
    throw err;
  }

  try {
    await decideOnDecision(prisma, {
      decisionId: decision.id,
      action,
      reason,
      actorUserId: user.id,
    });
  } catch (err) {
    let code = "unknown";
    if (err instanceof MissingRequiredCommentError) code = "missing_comment";
    else if (err instanceof UnavailableActionError) code = "unavailable_action";
    else if (err instanceof InvalidDecisionTransitionError) code = "invalid_transition";
    else if (err instanceof DecisionNotFoundError) code = "not_found";
    const url = new URL(returnTo, origin);
    url.searchParams.set("actionError", code);
    return NextResponse.redirect(url, { status: 303 });
  }

  const url = new URL(returnTo, origin);
  url.searchParams.set("actionOk", "1");
  return NextResponse.redirect(url, { status: 303 });
}
