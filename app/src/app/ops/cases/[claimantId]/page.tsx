// Case workspace -- doc 02's case detail view plus doc 04's
// communication timeline (P3-12). Everything that touches this one
// claimant lives here: pending decisions (with real action buttons),
// decision history, the case summary, operator notes, and the
// communication timeline.
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/requireSession";
import {
  fetchCommunicationTimeline,
  type CommunicationChannel,
  type CommunicationTimelineItem,
} from "@/lib/communicationTimeline";
import { getDecisionTypeConfig } from "@/lib/decisionTypes";
import { fetchCaseSummaryInput } from "@/lib/caseSummaryContext";
import { generateCaseSummary } from "@/lib/caseSummary";
import { fetchDecisionHistory } from "@/lib/decisionHistory";
import { fetchNotesForClaimant } from "@/lib/notes";
import { OpsStyles, OpsTopBar, DecisionActionForm } from "../../opsUi";

export const dynamic = "force-dynamic";

const CHANNELS: readonly CommunicationChannel[] = ["EMAIL", "SMS", "VOICE", "MAIL"];

const ACTION_ERROR_MESSAGES: Record<string, string> = {
  permission: "Your role isn't authorized for that action on this decision.",
  missing_comment: "That decision type requires a reason -- nothing was submitted with one.",
  unavailable_action: "That action isn't available for this decision type.",
  invalid_transition: "That decision can't move to the requested status from its current one.",
  not_found: "That decision no longer exists.",
  unknown: "Something went wrong applying that action.",
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  APPROVED: { bg: "var(--green-bg)", fg: "var(--green)" },
  REJECTED: { bg: "var(--rust-bg)", fg: "var(--rust)" },
  REVISED: { bg: "var(--amber-bg)", fg: "var(--amber)" },
  ESCALATED: { bg: "var(--amber-bg)", fg: "var(--amber)" },
  DEFERRED: { bg: "#e2e6ee", fg: "#2a3a5c" },
  CANCELLED: { bg: "#ece7d8", fg: "var(--mono)" },
  COMPLETED: { bg: "var(--green-bg)", fg: "var(--green)" },
  EXPIRED: { bg: "#ece7d8", fg: "var(--mono)" },
};

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TimelineRow({ item }: { item: CommunicationTimelineItem }) {
  return (
    <li
      style={{
        border: item.requiresAttention ? "1px solid var(--rust)" : "1px solid var(--line-soft)",
        background: item.requiresAttention ? "var(--rust-bg)" : "#fffdf6",
        borderRadius: 5,
        padding: "12px 14px",
        listStyle: "none",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--dim)",
              border: "1px solid var(--line)",
              borderRadius: 4,
              padding: "1px 7px",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {item.channel}
          </span>
          <span style={{ fontSize: 12, color: item.direction === "INBOUND" ? "var(--navy)" : "var(--dim)" }}>
            {item.direction === "INBOUND" ? "↓ inbound" : "↑ outbound"}
          </span>
          {item.humanHandling && <span style={{ fontSize: 11, color: "var(--amber)" }}>· operator handling</span>}
        </div>
        <span style={{ fontSize: 12, color: "var(--mono)", whiteSpace: "nowrap" }}>{formatTimestamp(item.createdAt)}</span>
      </div>
      {item.subject && <div style={{ fontWeight: 600, marginTop: 6, fontSize: 13.5 }}>{item.subject}</div>}
      <div style={{ marginTop: 4, color: "var(--text)", fontSize: 13.5 }}>{item.displaySummary}</div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--mono)" }}>
        {item.sender} → {item.recipient}
        {item.classification && <> · classified as {item.classification}</>}
        {item.requiresAttention && <span style={{ color: "var(--rust)", fontWeight: 600 }}> · requires attention</span>}
      </div>
    </li>
  );
}

export default async function CaseWorkspacePage({
  params,
  searchParams,
}: {
  params: { claimantId: string };
  searchParams: { channel?: string; actionOk?: string; actionError?: string; noteError?: string };
}) {
  const user = await requireSession();

  const claimant = await prisma.claimant.findUnique({
    where: { id: params.claimantId },
    include: { person: true, estate: true },
  });
  if (!claimant) {
    notFound();
  }

  const [timeline, pendingDecisions, history, notes, summaryInput] = await Promise.all([
    fetchCommunicationTimeline(prisma, claimant.id),
    prisma.decision.findMany({ where: { claimantId: claimant.id, status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    fetchDecisionHistory(prisma, claimant.id),
    fetchNotesForClaimant(prisma, claimant.id),
    fetchCaseSummaryInput(prisma, claimant.id),
  ]);

  const channelFilter = searchParams.channel;
  const filteredTimeline =
    channelFilter && CHANNELS.includes(channelFilter as CommunicationChannel)
      ? timeline.filter((item) => item.channel === channelFilter)
      : timeline;

  const summary = summaryInput ? generateCaseSummary(summaryInput) : null;

  return (
    <main className="ops-page">
      <OpsStyles />
      <OpsTopBar userName={user.name} userRole={user.role} active="case" />

      <a href="/ops" style={{ fontSize: 12.5, color: "var(--navy)", fontFamily: "'IBM Plex Mono', monospace" }}>
        ← Decision Queue
      </a>
      <h1 className="ops-h1" style={{ marginTop: 8 }}>
        {claimant.person.firstName} {claimant.person.lastName}
      </h1>
      <p className="ops-sub">
        {claimant.estate.decedentName} ({claimant.estate.caseNumber}) &middot; {claimant.status}
      </p>

      {searchParams.actionOk && <div className="ops-notice ok">Decision updated.</div>}
      {searchParams.actionError && (
        <div className="ops-notice error">{ACTION_ERROR_MESSAGES[searchParams.actionError] ?? ACTION_ERROR_MESSAGES.unknown}</div>
      )}
      {searchParams.noteError && <div className="ops-notice error">Note couldn&apos;t be added -- it was empty.</div>}

      <div className="ops-card">
        <div className="ops-card-title">Claimant Portal</div>
        <p style={{ fontSize: 12.5, color: "var(--dim)", margin: "0 0 10px" }}>
          Generates a private link this claimant can use to view their case, upload documents, and message you --
          no password, no account needed. Copy it and send it yourself (no automated send is wired up yet).
        </p>
        <form action="/api/portal-links" method="POST">
          <input type="hidden" name="claimantId" value={claimant.id} />
          <button type="submit" className="ops-btn ops-btn-primary">
            Generate Portal Link
          </button>
        </form>
      </div>

      {summary && (
        <div className="ops-card">
          <div className="ops-card-title">Case Summary</div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>{summary}</p>
        </div>
      )}

      {pendingDecisions.length > 0 && (
        <div className="ops-card">
          <div className="ops-card-title">Pending Decisions ({pendingDecisions.length})</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pendingDecisions.map((decision) => {
              const config = getDecisionTypeConfig(decision.decisionType);
              return (
                <li key={decision.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line-soft)" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{config.displayName}</div>
                  {decision.aiRecommendation && (
                    <div style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 3 }}>
                      AI recommendation: {decision.aiRecommendation}
                      {decision.aiConfidence != null && ` (${Math.round(decision.aiConfidence * 100)}% confidence)`}
                    </div>
                  )}
                  <DecisionActionForm
                    decisionId={decision.id}
                    actions={config.availableActions}
                    requiresComment={config.requiresComment}
                    returnTo={`/ops/cases/${claimant.id}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="ops-grid2">
        <div>
          <div className="ops-card">
            <div className="ops-card-title">Communication History</div>
            <div className="ops-chips">
              <a
                href={`/ops/cases/${claimant.id}`}
                className={`ops-chip${!channelFilter ? " active" : ""}`}
              >
                All
              </a>
              {CHANNELS.map((channel) => (
                <a
                  key={channel}
                  href={`/ops/cases/${claimant.id}?channel=${channel}`}
                  className={`ops-chip${channelFilter === channel ? " active" : ""}`}
                >
                  {channel}
                </a>
              ))}
            </div>
            {timeline.length === 0 ? (
              <p style={{ color: "var(--dim)", fontSize: 13 }}>
                No communications recorded yet. (Expected right now -- no live inbound provider is wired up yet; see
                PLAN.md P3-3/P3-9.)
              </p>
            ) : filteredTimeline.length === 0 ? (
              <p style={{ color: "var(--dim)", fontSize: 13 }}>No {channelFilter} communications for this case.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {filteredTimeline.map((item) => (
                  <TimelineRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Decision History ({history.length})</div>
            {history.length === 0 ? (
              <p style={{ color: "var(--dim)", fontSize: 13 }}>No decisions have been resolved on this case yet.</p>
            ) : (
              history.map((item) => {
                const color = STATUS_COLOR[item.status] ?? { bg: "#ece7d8", fg: "var(--mono)" };
                return (
                  <div key={item.id} className="ops-history-item">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600 }}>{item.decisionTypeDisplayName}</span>
                      <span className="ops-history-status" style={{ background: color.bg, color: color.fg }}>
                        {item.status}
                      </span>
                    </div>
                    <div style={{ color: "var(--dim)", fontSize: 12, marginTop: 3 }}>
                      {item.selectedAction && <>{humanizeAction(item.selectedAction)} &middot; </>}
                      {item.decidedByName ?? "unknown"} {item.decidedAt ? `· ${formatTimestamp(item.decidedAt)}` : ""}
                    </div>
                    {item.reason && <div style={{ fontSize: 12.5, marginTop: 4, color: "var(--text)" }}>{item.reason}</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <div className="ops-card">
            <div className="ops-card-title">Notes ({notes.length})</div>
            {notes.map((note) => (
              <div key={note.id} className="ops-note">
                {note.content}
                <div className="ops-note-meta">
                  {note.authorName} &middot; {formatTimestamp(note.createdAt)}
                </div>
              </div>
            ))}
            <form action="/api/notes" method="POST" className="ops-note-form" style={{ marginTop: 10 }}>
              <input type="hidden" name="claimantId" value={claimant.id} />
              <textarea name="content" placeholder="Add a note visible to every operator on this case…" required />
              <button type="submit" className="ops-btn ops-btn-primary">
                Add Note
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ");
}
