// Operator decision queue -- doc 02's "smart queue" UI. Reads real
// PENDING decisions from Postgres, ranked by src/lib/priority.ts.
//
// Gated by requireSession(). Per-role authorization for the actual
// Approve/Reject/Escalate/etc. actions happens server-side in
// /api/decisions/[id]/action (src/lib/auth.ts's DECIDE_ROUTINE_DECISIONS
// / DECIDE_HIGH_CONSEQUENCE_DECISIONS) -- this page just renders the
// controls; a role without permission gets redirected back with
// actionError=permission if they try to submit one.
import { prisma } from "@/lib/db";
import { fetchDecisionQueue, type DecisionQueueItem } from "@/lib/decisionQueue";
import { requireSession } from "@/lib/requireSession";
import { splitQueueByLane } from "@/lib/exceptionQueue";
import { fetchDashboardMetrics } from "@/lib/communicationDashboardMetrics";
import { getDecisionTypeConfig } from "@/lib/decisionTypes";
import { OpsStyles, OpsTopBar, StatTile, DecisionActionForm } from "./opsUi";
import type { PriorityLabel } from "@/lib/priority";

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

const PRIORITY_FILTERS: readonly PriorityLabel[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const ACTION_ERROR_MESSAGES: Record<string, string> = {
  permission: "Your role isn't authorized for that action on this decision.",
  missing_comment: "That decision type requires a reason -- nothing was submitted with one.",
  unavailable_action: "That action isn't available for this decision type.",
  invalid_transition: "That decision can't move to the requested status from its current one.",
  not_found: "That decision no longer exists.",
  unknown: "Something went wrong applying that action.",
};

function QueueCard({ item, exception }: { item: DecisionQueueItem; exception?: boolean }) {
  const config = getDecisionTypeConfig(item.decisionTypeKey);
  return (
    <li className={`ops-queue-card${exception ? " exception" : ""}`}>
      <div className="ops-queue-top">
        <div>
          <div className="ops-queue-title">{item.decisionTypeDisplayName}</div>
          <div className="ops-queue-meta">
            <a href={`/ops/cases/${item.claimantId}`} style={{ color: "inherit" }}>
              {item.claimantName} &middot; {item.decedentName} ({item.caseNumber})
            </a>
          </div>
          <div className="ops-queue-meta">
            {formatDeadline(item.deadline)} &middot; Est. value {formatMoney(item.estimatedValueCents)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className={`ops-priority ${item.priority.label}`}>{item.priority.label}</span>
          <div style={{ fontSize: 10.5, color: "var(--mono)", marginTop: 4 }}>score {Math.round(item.priority.score)}</div>
        </div>
      </div>
      <DecisionActionForm
        decisionId={item.id}
        actions={config.availableActions}
        requiresComment={config.requiresComment}
        returnTo="/ops"
      />
    </li>
  );
}

export default async function OpsQueuePage({
  searchParams,
}: {
  searchParams: { priority?: string; actionOk?: string; actionError?: string };
}) {
  const user = await requireSession();
  const items = await fetchDecisionQueue(prisma);
  const { decisions, exceptions } = splitQueueByLane(items);
  const metrics = await fetchDashboardMetrics(prisma);

  const priorityFilter = searchParams.priority as PriorityLabel | undefined;
  const filterFn = (item: DecisionQueueItem) => !priorityFilter || item.priority.label === priorityFilter;
  const visibleExceptions = exceptions.filter(filterFn);
  const visibleDecisions = decisions.filter(filterFn);

  return (
    <main className="ops-page">
      <OpsStyles />
      <OpsTopBar userName={user.name} userRole={user.role} active="queue" />

      <h1 className="ops-h1">Decision Queue</h1>
      <p className="ops-sub">
        {items.length} pending decision{items.length === 1 ? "" : "s"}, ranked by priority.
      </p>

      {searchParams.actionOk && <div className="ops-notice ok">Decision updated.</div>}
      {searchParams.actionError && (
        <div className="ops-notice error">
          {ACTION_ERROR_MESSAGES[searchParams.actionError] ?? ACTION_ERROR_MESSAGES.unknown}
        </div>
      )}

      <div className="ops-stat-row">
        <StatTile label="Messages sent" value={metrics.messagesSent} />
        <StatTile label="Messages received" value={metrics.messagesReceived} />
        <StatTile label="Pending responses" value={metrics.pendingResponses} />
        <StatTile label="Exceptions" value={metrics.exceptions} />
        <StatTile label="Opt-outs" value={metrics.optOuts} />
        <StatTile label="Failed" value={metrics.failedCommunications} />
        <StatTile
          label="Automated response rate"
          value={metrics.automatedResponseRate == null ? "—" : `${metrics.automatedResponseRate}%`}
        />
        <StatTile
          label="Escalation rate"
          value={metrics.escalationRate == null ? "—" : `${metrics.escalationRate}%`}
        />
      </div>

      <div className="ops-chips">
        <a href="/ops" className={`ops-chip${!priorityFilter ? " active" : ""}`}>
          All
        </a>
        {PRIORITY_FILTERS.map((label) => (
          <a key={label} href={`/ops?priority=${label}`} className={`ops-chip${priorityFilter === label ? " active" : ""}`}>
            {label}
          </a>
        ))}
      </div>

      {items.length === 0 ? (
        <p style={{ color: "var(--dim)" }}>
          No pending decisions. (Expected right now -- cases are imported (P0-11) but nothing creates a Decision yet;
          that&apos;s the outreach/document-request workflow, still Phase 4+.)
        </p>
      ) : (
        <>
          {visibleExceptions.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 15, color: "var(--rust)", marginBottom: 10, fontFamily: "'Playfair Display', serif" }}>
                Exceptions ({visibleExceptions.length})
              </h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {visibleExceptions.map((item) => (
                  <QueueCard key={item.id} item={item} exception />
                ))}
              </ul>
            </section>
          )}

          {visibleDecisions.length > 0 && (
            <section>
              {visibleExceptions.length > 0 && (
                <h2 style={{ fontSize: 15, marginBottom: 10, fontFamily: "'Playfair Display', serif", color: "var(--navy)" }}>
                  Decisions ({visibleDecisions.length})
                </h2>
              )}
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {visibleDecisions.map((item) => (
                  <QueueCard key={item.id} item={item} />
                ))}
              </ul>
            </section>
          )}

          {visibleExceptions.length === 0 && visibleDecisions.length === 0 && (
            <p style={{ color: "var(--dim)" }}>No decisions match this filter.</p>
          )}
        </>
      )}
    </main>
  );
}
