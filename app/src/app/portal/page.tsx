// "My Case" -- the claimant portal's home page, matching the approved
// Client Portal mockup: stepper, document checklist + upload prompt,
// case timeline, recovery summary. Real data throughout; no placeholder
// figures.
import { prisma } from "@/lib/db";
import { requirePortalSession } from "@/lib/requirePortalSession";
import { buildPortalCaseView, type PortalStepperStep } from "@/lib/portalCaseView";
import type { RequirementCandidateDocument } from "@/lib/documentRequirements";
import { PortalStyles, PortalTopBar } from "./portalUi";

export const dynamic = "force-dynamic";

const STEP_LABELS: Record<PortalStepperStep, string> = {
  CONTACTED: "Contacted",
  IDENTITY_VERIFIED: "Identity Verified",
  DOCUMENTS: "Documents",
  CLAIM_READY: "Claim Ready",
  FILED: "Filed",
  RECOVERY_AND_PAYMENT: "Recovery & Payment",
};

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PortalCasePage() {
  const claimant = await requirePortalSession();

  const [person, estate, documents, transitions, latestInvoice] = await Promise.all([
    prisma.person.findUnique({ where: { id: claimant.personId } }),
    prisma.estate.findUnique({ where: { id: claimant.estateId } }),
    prisma.document.findMany({ where: { claimantId: claimant.id } }),
    prisma.claimantStateTransition.findMany({
      where: { claimantId: claimant.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findFirst({ where: { claimantId: claimant.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const view = buildPortalCaseView({
    claimantStatus: claimant.status,
    documents: documents.map(
      (doc): RequirementCandidateDocument => ({
        id: doc.id,
        documentType: doc.documentType as RequirementCandidateDocument["documentType"],
        validationStatus: doc.validationStatus,
        duplicateStatus: doc.duplicateStatus,
      })
    ),
    estimatedRecoveryCents: estate?.estimatedValueCents ?? null,
    feeAmountCents: latestInvoice?.feeAmountCents ?? null,
  });

  return (
    <main className="portal-page">
      <PortalStyles />
      <PortalTopBar active="case" />

      <h1 className="portal-h1">Welcome back{person ? `, ${person.firstName}` : ""}</h1>
      <p className="portal-sub">
        Here&apos;s where things stand on the estate of {estate?.decedentName ?? "this case"}.
      </p>

      <div className="portal-stepper-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Playfair Display', serif", color: "var(--navy)" }}>
              Case {estate?.caseNumber ?? ""} &mdash; {claimant.status.replace(/_/g, " ")}
            </div>
          </div>
          <span className="portal-status-pill">On file</span>
        </div>
        <div className="portal-stepper">
          {view.stepper.map((s, index) => (
            <div key={s.step} className={`portal-step ${s.status}`}>
              <div className="portal-step-dot">{s.status === "done" ? "✓" : index + 1}</div>
              <div className="portal-step-label">{STEP_LABELS[s.step]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="portal-card">
        <div className="portal-card-title">
          Documents{" "}
          <span style={{ textTransform: "none", fontWeight: 500 }}>
            {view.documentChecklist.length - view.missingRequiredDocuments.length} of {view.documentChecklist.length} complete
          </span>
        </div>
        {view.documentChecklist.map((item) => (
          <div key={item.requirement.key} className="portal-doc-row">
            <span>{item.requirement.displayName}</span>
            <span className={`portal-doc-status ${item.status === "SATISFIED" ? "ok" : item.status === "RECEIVED_UNVALIDATED" ? "pending" : "missing"}`}>
              {item.status === "SATISFIED" ? "Verified" : item.status === "RECEIVED_UNVALIDATED" ? "Received" : "Needed"}
            </span>
          </div>
        ))}
      </div>

      {view.missingRequiredDocuments.length > 0 && (
        <div className="portal-card portal-sign-card">
          <div className="portal-card-title">Action needed</div>
          <div className="portal-sign-desc">
            <b>
              {view.missingRequiredDocuments.length} document{view.missingRequiredDocuments.length === 1 ? "" : "s"} left.
            </b>{" "}
            Upload {view.missingRequiredDocuments.map((d) => d.requirement.displayName).join(", ")} to move your case
            forward.
          </div>
          <a href="/portal/documents" className="portal-btn portal-btn-primary" style={{ textDecoration: "none" }}>
            Upload Documents
          </a>
        </div>
      )}

      <div className="portal-card">
        <div className="portal-card-title">Case Timeline</div>
        {transitions.length === 0 ? (
          <p style={{ color: "var(--dim)", fontSize: 13 }}>No status changes recorded yet.</p>
        ) : (
          <div className="portal-timeline">
            {transitions.map((t) => (
              <div key={t.id} className="portal-tl-item done">
                <div className="portal-tl-dot" />
                <div>
                  <div className="portal-tl-text">
                    Status changed to <b>{t.toStatus.replace(/_/g, " ")}</b>
                  </div>
                  <div className="portal-tl-time">{formatDate(t.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="portal-card">
        <div className="portal-card-title">Recovery Summary</div>
        <div className="portal-summary-row">
          <div className="portal-summary-label">Estimated recovery</div>
          <div className="portal-summary-value">{formatMoney(view.recoverySummary.estimatedRecoveryCents)}</div>
        </div>
        <div className="portal-summary-row">
          <div className="portal-summary-label">Our fee</div>
          <div className="portal-summary-value">
            {view.recoverySummary.feeAmountCents != null ? formatMoney(view.recoverySummary.feeAmountCents) : "Per your signed agreement"}
          </div>
        </div>
        {view.recoverySummary.estimatedToClaimantCents != null && (
          <div className="portal-summary-row">
            <div className="portal-summary-label">Estimated amount to you</div>
            <div className="portal-summary-value big">{formatMoney(view.recoverySummary.estimatedToClaimantCents)}</div>
          </div>
        )}
        <p style={{ color: "var(--mono)", fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
          Figures are estimates until the claim is filed and approved. You are never charged unless and until funds
          are recovered.
        </p>
      </div>
    </main>
  );
}
