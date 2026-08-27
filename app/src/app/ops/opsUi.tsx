// Shared presentational pieces for every /ops page -- the branded shell
// (topbar/nav/user chip), card/button/pill styles, and the responsive
// rules that make this usable one-handed on a phone (per Ethan: "I'm
// just on my phone clicking yes/no"). Plain server-rendered
// components/CSS, no client JS -- consistent with every other page in
// this app.

export const OPS_CSS = `
  .ops-page { max-width: 1100px; margin: 0 auto; padding: 16px 16px 48px; }
  .ops-topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 4px; margin-bottom: 20px; border-bottom: 1px solid var(--line);
    flex-wrap: wrap; gap: 10px;
  }
  .ops-brand { display: flex; align-items: center; gap: 10px; }
  .ops-diamond {
    width: 30px; height: 30px; border: 1.5px solid var(--navy); transform: rotate(45deg);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .ops-diamond span { transform: rotate(-45deg); font-family: "Playfair Display", serif; font-weight: 700; font-size: 10px; color: var(--navy); }
  .ops-brand-name { font-weight: 700; font-size: 17px; font-family: "Playfair Display", serif; color: var(--navy); }
  .ops-brand-sub { color: var(--mono); font-size: 10px; margin-top: 1px; font-family: "IBM Plex Mono", monospace; text-transform: uppercase; letter-spacing: 0.08em; }
  .ops-nav { display: flex; gap: 18px; flex-wrap: wrap; }
  .ops-nav a { color: var(--dim); font-size: 12.5px; font-weight: 600; text-decoration: none; font-family: "IBM Plex Mono", monospace; letter-spacing: 0.03em; }
  .ops-nav a.active { color: var(--navy); border-bottom: 2px solid var(--gold); padding-bottom: 3px; }
  .ops-user-chip { display: flex; align-items: center; gap: 10px; background: var(--cream2); border: 1px solid var(--line); border-radius: 3px; padding: 6px 12px; font-size: 12.5px; color: var(--dim); }
  .ops-user-chip form button { background: none; border: none; padding: 0; color: var(--navy); font-weight: 600; cursor: pointer; font: inherit; text-decoration: underline; }

  .ops-h1 { font-size: 22px; margin: 0 0 4px; font-family: "Playfair Display", serif; color: var(--navy); }
  .ops-sub { color: var(--dim); font-size: 13px; margin: 0 0 18px; }

  .ops-card { background: #fffdf6; border: 1px solid var(--line-soft); border-radius: 5px; padding: 18px 18px; margin-bottom: 14px; }
  .ops-card-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mono); margin-bottom: 12px; font-family: "IBM Plex Mono", monospace; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }

  .ops-stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
  .ops-stat { flex: 1 1 120px; background: #fffdf6; border: 1px solid var(--line-soft); border-radius: 5px; padding: 12px 14px; }
  .ops-stat-value { font-size: 20px; font-weight: 700; font-family: "Playfair Display", serif; color: var(--navy); }
  .ops-stat-label { font-size: 10.5px; color: var(--mono); font-family: "IBM Plex Mono", monospace; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }

  .ops-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
  .ops-chip { font-size: 11px; padding: 6px 12px; border-radius: 3px; background: #fffdf6; color: var(--dim); border: 1px solid var(--line); font-family: "IBM Plex Mono", monospace; text-decoration: none; white-space: nowrap; }
  .ops-chip.active { background: var(--navy); color: #f2ecd9; border-color: var(--navy); }

  .ops-queue-card {
    background: #fffdf6; border: 1px solid var(--line-soft); border-radius: 5px; padding: 14px 16px; margin-bottom: 10px;
  }
  .ops-queue-card.exception { border-color: var(--rust); background: var(--rust-bg); }
  .ops-queue-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
  .ops-queue-title { font-weight: 700; font-size: 14.5px; color: var(--text); }
  .ops-queue-meta { color: var(--dim); font-size: 12.5px; margin-top: 3px; }
  .ops-priority { font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; padding: 3px 9px; border-radius: 3px; font-family: "IBM Plex Mono", monospace; white-space: nowrap; }
  .ops-priority.URGENT { background: var(--rust-bg); color: var(--rust); }
  .ops-priority.HIGH { background: var(--amber-bg); color: var(--amber); }
  .ops-priority.MEDIUM { background: #dfe4ee; color: #2a3a5c; }
  .ops-priority.LOW { background: #ece7d8; color: var(--mono); }

  .ops-action-form { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line-soft); }
  .ops-action-form textarea {
    width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 4px;
    background: var(--cream2); color: var(--text); font-size: 13.5px; margin-bottom: 8px; resize: vertical;
  }
  .ops-action-buttons { display: flex; flex-wrap: wrap; gap: 8px; }

  .ops-btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 11px 16px; min-height: 40px; border-radius: 4px; font-weight: 600; font-size: 12.5px;
    border: 1px solid transparent; font-family: "IBM Plex Mono", monospace; letter-spacing: 0.02em; cursor: pointer;
  }
  .ops-btn-approve { background: var(--green); color: #fff; }
  .ops-btn-reject { background: var(--rust); color: #fff; }
  .ops-btn-escalate { background: var(--amber); color: #fff; }
  .ops-btn-neutral { background: #fffdf6; color: var(--navy); border-color: var(--navy); }
  .ops-btn-primary { background: var(--gold); color: #fff; }

  .ops-notice { padding: 10px 14px; border-radius: 4px; font-size: 13px; margin-bottom: 16px; }
  .ops-notice.ok { background: var(--green-bg); color: var(--green); }
  .ops-notice.error { background: var(--rust-bg); color: var(--rust); }

  .ops-history-item { padding: 10px 0; border-bottom: 1px solid var(--line-soft); font-size: 13px; }
  .ops-history-item:last-child { border-bottom: none; }
  .ops-history-status { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 3px; }

  .ops-note { background: var(--cream2); border: 1px solid var(--line-soft); border-radius: 4px; padding: 10px 12px; margin-bottom: 8px; font-size: 13px; }
  .ops-note-meta { font-size: 10.5px; color: var(--mono); margin-top: 5px; font-family: "IBM Plex Mono", monospace; }
  .ops-note-form textarea { width: 100%; min-height: 60px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 4px; background: #fffdf6; font-size: 13.5px; margin-bottom: 8px; }

  .ops-grid2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; }
  @media (max-width: 720px) {
    .ops-grid2 { grid-template-columns: 1fr; }
    .ops-topbar { flex-direction: column; align-items: flex-start; }
    .ops-btn { flex: 1 1 auto; }
  }
`;

export function OpsStyles() {
  // eslint-disable-next-line react/no-danger
  return <style dangerouslySetInnerHTML={{ __html: OPS_CSS }} />;
}

export function OpsTopBar({
  userName,
  userRole,
  active,
}: {
  userName: string;
  userRole: string;
  active: "queue" | "case";
}) {
  return (
    <div className="ops-topbar">
      <div className="ops-brand">
        <div className="ops-diamond">
          <span>R&amp;K</span>
        </div>
        <div>
          <div className="ops-brand-name">Rosenthal &amp; Kin</div>
          <div className="ops-brand-sub">Operator Console</div>
        </div>
      </div>
      <nav className="ops-nav">
        <a href="/ops" className={active === "queue" ? "active" : undefined}>
          Decision Queue
        </a>
      </nav>
      <div className="ops-user-chip">
        {userName} ({userRole})
        <form action="/api/auth/logout" method="POST" style={{ display: "inline" }}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    </div>
  );
}

export function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="ops-stat">
      <div className="ops-stat-value">{value}</div>
      <div className="ops-stat-label">{label}</div>
    </div>
  );
}

// Maps an ACTION verb (from decisionTypes.ts's availableActions) to a
// button color/label so every decision type's controls read
// consistently without a per-type switch statement scattered across
// pages.
const ACTION_BUTTON_CLASS: Record<string, string> = {
  APPROVE: "ops-btn-approve",
  APPROVE_AND_FILE: "ops-btn-approve",
  SEND: "ops-btn-approve",
  VERIFY: "ops-btn-approve",
  RESOLVE: "ops-btn-approve",
  CLOSE_CASE: "ops-btn-approve",
  CLOSE: "ops-btn-approve",
  CREATE_NEW_CASE: "ops-btn-approve",
  KEEP_NEW: "ops-btn-approve",
  KEEP_EXISTING: "ops-btn-approve",
  KEEP_BOTH: "ops-btn-approve",
  YES: "ops-btn-approve",
  REJECT: "ops-btn-reject",
  REJECT_CASE: "ops-btn-reject",
  REJECT_CLAIM: "ops-btn-reject",
  RULE_OUT: "ops-btn-reject",
  NO: "ops-btn-reject",
  ESCALATE: "ops-btn-escalate",
  REVISE: "ops-btn-neutral",
  REVISE_PACKAGE: "ops-btn-neutral",
  REQUEST_MORE_EVIDENCE: "ops-btn-neutral",
  REQUEST_DOCUMENT: "ops-btn-neutral",
  RESEARCH: "ops-btn-neutral",
  RETRY: "ops-btn-neutral",
  DEFER: "ops-btn-neutral",
  KEEP_OPEN: "ops-btn-neutral",
  CANCEL: "ops-btn-neutral",
};

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ");
}

/**
 * The actual Approve/Reject/Escalate/etc. controls for one decision --
 * a plain HTML form per action, no client JS. `requiresComment`
 * decisions get one shared reason textarea above the buttons (the
 * server rejects a submit with no reason via MissingRequiredCommentError,
 * surfaced back through the actionError query param).
 */
export function DecisionActionForm({
  decisionId,
  actions,
  requiresComment,
  returnTo,
}: {
  decisionId: string;
  actions: readonly string[];
  requiresComment: boolean;
  returnTo: string;
}) {
  return (
    <div className="ops-action-form">
      <div className="ops-action-buttons">
        {actions.map((action) => (
          <form key={action} action={`/api/decisions/${decisionId}/action`} method="POST">
            <input type="hidden" name="action" value={action} />
            <input type="hidden" name="returnTo" value={returnTo} />
            {requiresComment && (
              <textarea
                name="reason"
                placeholder="Reason (required)"
                required
                style={{ width: "100%", minHeight: 36, marginBottom: 6, padding: 8, borderRadius: 4, border: "1px solid var(--line)", fontSize: 12.5, background: "var(--cream2)" }}
              />
            )}
            <button type="submit" className={`ops-btn ${ACTION_BUTTON_CLASS[action] ?? "ops-btn-neutral"}`}>
              {humanizeAction(action)}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
