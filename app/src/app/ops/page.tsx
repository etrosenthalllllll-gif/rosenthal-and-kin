// Operator decision queue -- doc 02's "smart queue" UI. Reads real
// PENDING decisions from Postgres, ranked by src/lib/priority.ts.
//
// KNOWN GAP, not an oversight: this route has no auth/session gate yet.
// P0-6 built the permission-check primitive (src/lib/auth.ts) but the
// login/session endpoint itself isn't wired up (still todo per PLAN.md).
// Anyone who reaches this URL sees it. Do not treat this as
// production-ready until that's closed -- flagging loudly rather than
// quietly shipping an unauthenticated case-management view.
import { prisma } from "@/lib/db";
import { fetchDecisionQueue } from "@/lib/decisionQueue";

export const dynamic = "force-dynamic";

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatDeadline(deadline: Date | null): string {
  if (!deadline) return "No deadline";
  const now = new Date();
  const overdue = deadline.getTime() < now.getTime();
  const formatted = deadline.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return overdue ? `${formatted} (overdue)` : formatted;
}

const LABEL_COLOR: Record<string, string> = {
  URGENT: "#b91c1c",
  HIGH: "#b45309",
  MEDIUM: "#1d4ed8",
  LOW: "#4b5563",
};

export default async function OpsQueuePage() {
  const items = await fetchDecisionQueue(prisma);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>Decision Queue</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        {items.length} pending decision{items.length === 1 ? "" : "s"}, ranked by priority.
      </p>

      {items.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          No pending decisions. (Expected right now -- cases are imported (P0-11) but nothing creates a Decision yet;
          that&apos;s the outreach/document-request workflow, still Phase 4+.)
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{item.decisionTypeDisplayName}</div>
                <div style={{ color: "#374151" }}>
                  {item.claimantName} &middot; {item.decedentName} ({item.caseNumber})
                </div>
                <div style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                  {formatDeadline(item.deadline)} &middot; Est. value {formatMoney(item.estimatedValueCents)}
                </div>
              </div>
              <div
                style={{
                  color: LABEL_COLOR[item.priority.label],
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {item.priority.label}
                <div style={{ fontWeight: 400, fontSize: "0.75rem", color: "#6b7280" }}>
                  score {Math.round(item.priority.score)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
