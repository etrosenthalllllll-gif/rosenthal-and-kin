// Full document list + real upload -- doc 05's client portal document
// section. Upload goes straight to R2 via /api/portal/documents.
import { prisma } from "@/lib/db";
import { requirePortalSession } from "@/lib/requirePortalSession";
import { buildDocumentChecklist, detectMissingDocuments, type RequirementCandidateDocument } from "@/lib/documentRequirements";
import { PortalStyles, PortalTopBar } from "../portalUi";

export const dynamic = "force-dynamic";

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  no_file: "No file was selected.",
  storage_unavailable: "Upload storage isn't configured on this deployment yet -- contact your case handler.",
};

export default async function PortalDocumentsPage({
  searchParams,
}: {
  searchParams: { uploadOk?: string; uploadError?: string };
}) {
  const claimant = await requirePortalSession();
  const documents = await prisma.document.findMany({
    where: { claimantId: claimant.id },
    orderBy: { createdAt: "desc" },
  });

  const checklist = buildDocumentChecklist(
    "CLAIMANT_VERIFICATION",
    documents.map(
      (doc): RequirementCandidateDocument => ({
        id: doc.id,
        documentType: doc.documentType as RequirementCandidateDocument["documentType"],
        validationStatus: doc.validationStatus,
        duplicateStatus: doc.duplicateStatus,
      })
    )
  );
  const missing = detectMissingDocuments(checklist);

  return (
    <main className="portal-page">
      <PortalStyles />
      <PortalTopBar active="documents" />
      <h1 className="portal-h1">Documents</h1>
      <p className="portal-sub">Everything you&apos;ve provided, and what&apos;s still needed.</p>

      {searchParams.uploadOk && <div className="portal-notice ok">Document uploaded -- thank you.</div>}
      {searchParams.uploadError && (
        <div className="portal-notice error">
          {UPLOAD_ERROR_MESSAGES[searchParams.uploadError] ?? "Something went wrong with that upload."}
        </div>
      )}

      {missing.length > 0 && (
        <div className="portal-card">
          <div className="portal-card-title">Needed</div>
          {missing.map((item) => (
            <form
              key={item.requirement.key}
              action="/api/portal/documents"
              method="POST"
              encType="multipart/form-data"
              className="portal-doc-row"
              style={{ flexDirection: "column", alignItems: "stretch" }}
            >
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>{item.requirement.displayName}</div>
              {item.requirement.satisfiedByAnyOf.length > 1 && (
                <select
                  name="documentType"
                  required
                  style={{ marginBottom: 8, padding: 8, borderRadius: 4, border: "1px solid var(--line)", fontSize: 13 }}
                >
                  {item.requirement.satisfiedByAnyOf.map((type) => (
                    <option key={type} value={type}>
                      {humanize(type)}
                    </option>
                  ))}
                </select>
              )}
              {item.requirement.satisfiedByAnyOf.length === 1 && (
                <input type="hidden" name="documentType" value={item.requirement.satisfiedByAnyOf[0]} />
              )}
              <input type="file" name="file" required style={{ marginBottom: 8, fontSize: 13 }} />
              <button type="submit" className="portal-btn portal-btn-primary">
                Upload
              </button>
            </form>
          ))}
        </div>
      )}

      <div className="portal-card">
        <div className="portal-card-title">On file ({documents.length})</div>
        {documents.length === 0 ? (
          <p style={{ color: "var(--dim)", fontSize: 13 }}>Nothing uploaded yet.</p>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="portal-doc-row">
              <span>{doc.originalFilename}</span>
              <span
                className={`portal-doc-status ${
                  doc.validationStatus === "VALID" ? "ok" : doc.validationStatus === "INVALID" ? "missing" : "pending"
                }`}
              >
                {doc.validationStatus === "VALID" ? "Verified" : doc.validationStatus === "INVALID" ? "Rejected" : "Pending review"}
              </span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
