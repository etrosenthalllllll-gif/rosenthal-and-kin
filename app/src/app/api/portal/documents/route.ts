// Claimant document upload -- doc 05's client portal. Real upload to
// R2 via the already-built DocumentStorageProvider (P0-7), not a stub.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePortalSession } from "@/lib/requirePortalSession";
import { createR2ProviderFromEnv } from "@/lib/providers/r2DocumentStorageProvider";
import { getPublicOrigin } from "@/lib/requestOrigin";

export async function POST(req: NextRequest) {
  const claimant = await requirePortalSession();
  const origin = getPublicOrigin(req);
  const returnUrl = new URL("/portal/documents", origin);

  const form = await req.formData();
  const file = form.get("file");
  const documentType = String(form.get("documentType") ?? "OTHER");

  if (!(file instanceof File) || file.size === 0) {
    returnUrl.searchParams.set("uploadError", "no_file");
    return NextResponse.redirect(returnUrl, { status: 303 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = `claimant-uploads/${claimant.id}/${Date.now()}-${file.name}`;

  try {
    const provider = createR2ProviderFromEnv();
    const uploaded = await provider.put(storageKey, buffer, file.type || "application/octet-stream");

    await prisma.document.create({
      data: {
        claimantId: claimant.id,
        estateId: claimant.estateId,
        documentType,
        source: "CLAIMANT_PORTAL",
        originalFilename: file.name,
        storageKey: uploaded.storageKey,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
      },
    });
  } catch (err) {
    // Most likely R2 env vars aren't configured on this deploy yet --
    // surface it honestly rather than pretending the upload succeeded.
    returnUrl.searchParams.set("uploadError", "storage_unavailable");
    return NextResponse.redirect(returnUrl, { status: 303 });
  }

  returnUrl.searchParams.set("uploadOk", "1");
  return NextResponse.redirect(returnUrl, { status: 303 });
}
