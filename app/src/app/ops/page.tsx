// Operator decision queue -- doc 02's "smart queue" UI. Reads real
// PENDING decisions from Postgres, ranked by src/lib/priority.ts.
//
// Gated by requireSession() below -- closes the auth gap this file used
// to flag loudly. Note this is authentication only (any logged-in user
// sees the queue); per-role authorization via src/lib/auth.ts's
// requirePermission() still needs wiring into individual actions once
// this page does more than read. See PLAN.md P0-6.
import { prisma } from "@/lib/db";
import { fetchDecisionQueue, type DecisionQueueItem } from "@/lib/decisionQueue";
import { requireSession } from "@/lib/requireSession";
import { splitQueueByLane } from "@/lib/exceptionQueue";
import { fetchDashboardMetrics } from "@/lib/communicationDashboardMetrics";

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

function QueueCard({ item, exception }: { item: DecisionQueueItem; exception?: boolean }) {
  return (
    <li
      style={{
        border: exception ? "1px solid #fca5a5" : "1px solid #e5e7eb",
        background: exception ? "#fef2f2" : undefined,
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
          <a href={`/ops/cases/${item.claimantId}`} style={{ color: "inherit" }}>
            {item.claimantName} &middot; {item.decedentName} ({item.caseNumber})
          </a>
        </div>
        <div style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          {formatDeadline(item.deadline)} &middot; Est. value {formatMoney(item.estimatedValueCents)}
        </div>
      </div>
      <div style={{ color: LABEL_COLOR[item.priority.label], fontWeight: 700, whiteSpace: "nowrap" }}>
        {item.priority.label}
        <div style={{ fontWeight: 400, fontSize: "0.75rem", color: "#6b7280" }}>
          score {Math.round(item.priority.score)}
        </div>
      </div>
    </li>
  );
}

function MetricStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{label}</div>
    </div>
  );
}

export default async function OpsQueuePage() {
  const user = await requireSession();
  const items = await fetchDecisionQueue(prisma);
  // doc 02 section 12: exceptions are a distinct lane from routine
  // decisions, not a separate query -- both lanes come from the same
  // ranked queue, split by decision-type category. See exceptionQueue.ts.
  const { decisions, exceptions } = splitQueueByLane(items);
  // doc 04 section 26: communication dashboard metrics, linked into the
  // existing decision dashboard rather than a separate surface (P3-13).
  const metrics = await fetchDashboardMetrics(prisma);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>Decision Queue</h1>
        <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
          {user.name} ({user.role}) &middot;{" "}
          <form action="/api/auth/logout" method="POST" style={{ display: "inline" }}>
            <button type="submit" style={{ background: "none", border: "none", padding: 0, color: "#1d4ed8", cursor: "pointer", font: "inherit" }}>
              Sign out
            </button>
          </form>
        </div>
      </div>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        {items.length} pending decision{items.length === 1 ? "" : "s"}, ranked by priority.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <MetricStat label="Messages sent" value={metrics.messagesSent} />
        <MetricStat label="Messages received" value={metrics.messagesReceived} />
        <MetricStat label="Pending responses" value={metrics.pendingResponses} />
        <MetricStat label="Exceptions" value={metrics.exceptions} />
        <MetricStat label="Opt-outs" value={metrics.optOuts} />
        <MetricStat label="Failed" value={metrics.failedCommunications} />
        <MetricStat
          label="Automated response rate"
          value={metrics.automatedResponseRate == null ? "—" : `${metrics.automatedResponseRate}%`}
        />
        <MetricStat
          label="Escalation rate"
          value={metrics.escalationRate == null ? "—" : `${metrics.escalationRate}%`}
        />
      </div>

      {items.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          No pending decisions. (Expected right now -- cases are imported (P0-11) but nothing creates a Decision yet;
          that&apos;s the outreach/document-request workflow, still Phase 4+.)
        </p>
      ) : (
        <>
          {exceptions.length > 0 && (
            <section style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.1rem", color: "#b91c1c", marginBottom: "0.5rem" }}>
                Exceptions ({exceptions.length})
              </h2>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {exceptions.map((item) => (
                  <QueueCard key={item.id} item={item} exception />
                ))}
              </ul>
            </section>
          )}

          {decisions.length > 0 && (
            <section>
              {exceptions.length > 0 && (
                <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Decisions ({decisions.length})</h2>
              )}
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {decisions.map((item) => (
                  <QueueCard key={item.id} item={item} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
