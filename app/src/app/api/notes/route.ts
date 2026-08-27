// Adds an operator note to a case -- doc 02 section 13. Plain HTML form
// POST, no client JS needed.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/requireSession";
import { requirePermission, PermissionDeniedError } from "@/lib/auth";
import { createNote, EmptyNoteError } from "@/lib/notes";
import { getPublicOrigin } from "@/lib/requestOrigin";

export async function POST(req: NextRequest) {
  const user = await requireSession();
  const form = await req.formData();
  const claimantId = String(form.get("claimantId") ?? "");
  const content = String(form.get("content") ?? "");
  const origin = getPublicOrigin(req);
  const returnUrl = new URL(`/ops/cases/${claimantId}`, origin);

  try {
    requirePermission(user.role, "ADD_CASE_NOTES");
    await createNote(prisma, { claimantId, authorId: user.id, content });
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      returnUrl.searchParams.set("noteError", "permission");
    } else if (err instanceof EmptyNoteError) {
      returnUrl.searchParams.set("noteError", "empty");
    } else {
      throw err;
    }
    return NextResponse.redirect(returnUrl, { status: 303 });
  }

  return NextResponse.redirect(returnUrl, { status: 303 });
}
