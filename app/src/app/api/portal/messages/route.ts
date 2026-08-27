// Claimant sends a message through the portal -- creates a real
// Communication row (channel PORTAL, direction INBOUND) on a
// find-or-create Conversation, flagged for operator attention so it
// surfaces in /ops's pending-responses count -- the same dashboard
// metric every other inbound channel feeds.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePortalSession } from "@/lib/requirePortalSession";
import { getPublicOrigin } from "@/lib/requestOrigin";

export async function POST(req: NextRequest) {
  const claimant = await requirePortalSession();
  const origin = getPublicOrigin(req);
  const returnUrl = new URL("/portal/messages", origin);

  const form = await req.formData();
  const body = String(form.get("body") ?? "").trim();
  if (!body) {
    returnUrl.searchParams.set("messageError", "empty");
    return NextResponse.redirect(returnUrl, { status: 303 });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { claimantId: claimant.id, channel: "PORTAL" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        claimantId: claimant.id,
        personId: claimant.personId,
        channel: "PORTAL",
        attentionStatus: "OPERATOR_REQUIRED",
      },
    });
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { attentionStatus: "OPERATOR_REQUIRED" },
    });
  }

  await prisma.communication.create({
    data: {
      conversationId: conversation.id,
      claimantId: claimant.id,
      personId: claimant.personId,
      channel: "PORTAL",
      direction: "INBOUND",
      sender: "claimant-portal",
      recipient: "operator",
      body,
      status: "RECEIVED" as const,
    },
  });

  returnUrl.searchParams.set("messageOk", "1");
  return NextResponse.redirect(returnUrl, { status: 303 });
}
