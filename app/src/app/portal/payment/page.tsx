import { prisma } from "@/lib/db";
import { requirePortalSession } from "@/lib/requirePortalSession";
import { buildRecoverySummary } from "@/lib/portalCaseView";
import { PortalStyles, PortalTopBar } from "../portalUi";

export const dynamic = "force-dynamic";

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function PortalPaymentPage() {
  const claimant = await requirePortalSession();
  const [estate, invoices] = await Promise.all([
    prisma.estate.findUnique({ where: { id: claimant.estateId } }),
    prisma.invoice.findMany({ where: { claimantId: claimant.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const latestInvoice = invoices[0];
  const summary = buildRecoverySummary(estate?.estimatedValueCents ?? null, latestInvoice?.feeAmountCents ?? null);

  return (
    <main className="portal-page">
      <PortalStyles />
      <PortalTopBar active="payment" />
      <h1 className="portal-h1">Payment</h1>
      <p className="portal-sub">Your recovery, fee, and invoice history.</p>

      <div className="portal-card">
        <div className="portal-card-title">Recovery Summary</div>
        <div className="portal-summary-row">
          <div className="portal-summary-label">Estimated recovery</div>
          <div className="portal-summary-value">{formatMoney(summary.estimatedRecoveryCents)}</div>
        </div>
        <div className="portal-summary-row">
          <div className="portal-summary-label">Our fee</div>
          <div className="portal-summary-value">
            {summary.feeAmountCents != null ? formatMoney(summary.feeAmountCents) : "Per your signed agreement"}
          </div>
        </div>
        {summary.estimatedToClaimantCents != null && (
          <div className="portal-summary-row">
            <div className="portal-summary-label">Estimated amount to you</div>
            <div className="portal-summary-value big">{formatMoney(summary.estimatedToClaimantCents)}</div>
          </div>
        )}
      </div>

      <div className="portal-card">
        <div className="portal-card-title">Invoices ({invoices.length})</div>
        {invoices.length === 0 ? (
          <p style={{ color: "var(--dim)", fontSize: 13 }}>
            No invoices yet -- one is issued once your recovery is confirmed. You are never charged unless and until
            funds are recovered.
          </p>
        ) : (
          invoices.map((inv) => (
            <div key={inv.id} className="portal-summary-row">
              <div className="portal-summary-label">
                {inv.invoiceNumber} &middot; {inv.status}
              </div>
              <div className="portal-summary-value">{formatMoney(inv.totalDueCents)}</div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
