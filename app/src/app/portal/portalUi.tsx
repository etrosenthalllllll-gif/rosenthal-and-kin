// Shared presentational pieces for every /portal page -- matches the
// approved Client Portal mockup exactly (same brand tokens as
// ops/opsUi.tsx, defined once in layout.tsx's :root). Plain
// server-rendered components, no client JS.

export const PORTAL_CSS = `
  .portal-page { max-width: 900px; margin: 0 auto; padding: 16px 16px 48px; }
  .portal-topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 4px; margin-bottom: 20px; border-bottom: 1px solid var(--line);
    flex-wrap: wrap; gap: 10px;
  }
  .portal-brand { display: flex; align-items: center; gap: 10px; }
  .portal-diamond {
    width: 30px; height: 30px; border: 1.5px solid var(--navy); transform: rotate(45deg);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .portal-diamond span { transform: rotate(-45deg); font-family: "Playfair Display", serif; font-weight: 700; font-size: 10px; color: var(--navy); }
  .portal-brand-name { font-weight: 700; font-size: 17px; font-family: "Playfair Display", serif; color: var(--navy); }
  .portal-brand-sub { color: var(--mono); font-size: 10px; margin-top: 1px; font-family: "IBM Plex Mono", monospace; text-transform: uppercase; letter-spacing: 0.08em; }
  .portal-nav { display: flex; gap: 16px; flex-wrap: wrap; }
  .portal-nav a { color: var(--dim); font-size: 12.5px; font-weight: 600; text-decoration: none; font-family: "IBM Plex Mono", monospace; letter-spacing: 0.03em; }
  .portal-nav a.active { color: var(--navy); border-bottom: 2px solid var(--gold); padding-bottom: 3px; }

  .portal-h1 { font-size: 22px; margin: 0 0 4px; font-family: "Playfair Display", serif; color: var(--navy); }
  .portal-sub { color: var(--dim); font-size: 13px; margin: 0 0 18px; }

  .portal-card { background: #fffdf6; border: 1px solid var(--line-soft); border-radius: 5px; padding: 18px; margin-bottom: 14px; }
  .portal-card-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mono); margin-bottom: 12px; font-family: "IBM Plex Mono", monospace; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }

  .portal-stepper-card { background: #fffdf6; border: 1px solid var(--line-soft); border-radius: 5px; padding: 20px 18px; margin-bottom: 16px; }
  .portal-status-pill { background: var(--green-bg); color: var(--green); font-size: 10.5px; font-weight: 600; padding: 4px 10px; border-radius: 3px; font-family: "IBM Plex Mono", monospace; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
  .portal-stepper { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 12px 0; }
  .portal-step { display: flex; flex-direction: column; align-items: center; flex: 1 1 80px; min-width: 80px; position: relative; }
  .portal-step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; border: 1.5px solid var(--line); background: var(--cream2); color: var(--mono); font-family: "IBM Plex Mono", monospace; }
  .portal-step.done .portal-step-dot { background: var(--green); border-color: var(--green); color: #f4f7ed; }
  .portal-step.current .portal-step-dot { background: var(--navy); border-color: var(--navy); color: #f2ecd9; }
  .portal-step-label { font-size: 10px; color: var(--mono); margin-top: 7px; text-align: center; font-family: "IBM Plex Mono", monospace; }
  .portal-step.done .portal-step-label, .portal-step.current .portal-step-label { color: var(--navy); font-weight: 600; }

  .portal-doc-row { display: flex; align-items: center; justify-content: space-between; background: var(--cream2); border: 1px solid var(--line-soft); border-radius: 3px; padding: 10px 14px; margin-bottom: 8px; gap: 10px; flex-wrap: wrap; }
  .portal-doc-status { font-size: 10px; font-weight: 600; padding: 3px 9px; border-radius: 3px; font-family: "IBM Plex Mono", monospace; white-space: nowrap; }
  .portal-doc-status.ok { background: var(--green-bg); color: var(--green); }
  .portal-doc-status.pending { background: var(--amber-bg); color: var(--amber); }
  .portal-doc-status.missing { background: var(--rust-bg); color: var(--rust); }

  .portal-summary-row { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 0; border-bottom: 1px solid var(--line-soft); flex-wrap: wrap; gap: 4px; }
  .portal-summary-row:last-child { border-bottom: none; }
  .portal-summary-label { color: var(--dim); font-size: 13px; }
  .portal-summary-value { font-weight: 700; font-size: 15px; }
  .portal-summary-value.big { font-size: 22px; color: var(--green); font-family: "Playfair Display", serif; }

  .portal-sign-card { background: var(--navy2); border: 1px solid var(--navy2); }
  .portal-sign-card .portal-card-title { color: var(--gold-soft); }
  .portal-sign-desc { color: #c3c9d6; font-size: 13px; line-height: 1.6; margin-bottom: 14px; }

  .portal-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 16px; min-height: 42px; border-radius: 4px; font-weight: 600; font-size: 12.5px; border: 1px solid transparent; font-family: "IBM Plex Mono", monospace; letter-spacing: 0.02em; cursor: pointer; width: 100%; }
  .portal-btn-primary { background: var(--gold); color: #fff; }
  .portal-btn-secondary { background: var(--cream2); color: var(--navy); border-color: var(--line); }

  .portal-msg { max-width: 88%; padding: 11px 14px; border-radius: 4px; font-size: 13px; line-height: 1.55; margin-bottom: 10px; }
  .portal-msg.them { background: var(--cream2); border: 1px solid var(--line-soft); }
  .portal-msg.me { background: var(--navy); border: 1px solid var(--navy); color: #ece6d4; margin-left: auto; }
  .portal-msg-meta { font-size: 10px; color: var(--mono); margin-top: 5px; font-family: "IBM Plex Mono", monospace; }
  .portal-msg.me .portal-msg-meta { color: #b9c0d1; }
  .portal-msg-input { width: 100%; min-height: 70px; padding: 11px 14px; border: 1px solid var(--line); border-radius: 4px; background: var(--cream2); color: var(--mono); font-size: 13px; margin-bottom: 8px; }

  .portal-notice { padding: 10px 14px; border-radius: 4px; font-size: 13px; margin-bottom: 16px; }
  .portal-notice.ok { background: var(--green-bg); color: var(--green); }
  .portal-notice.error { background: var(--rust-bg); color: var(--rust); }

  .portal-timeline { display: flex; flex-direction: column; gap: 13px; }
  .portal-tl-item { display: flex; gap: 10px; }
  .portal-tl-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line); margin-top: 5px; flex-shrink: 0; }
  .portal-tl-item.done .portal-tl-dot { background: var(--green); }
  .portal-tl-text { font-size: 12.5px; color: var(--dim); line-height: 1.55; }
  .portal-tl-time { font-size: 10.5px; color: var(--mono); margin-top: 2px; font-family: "IBM Plex Mono", monospace; }
`;

export function PortalStyles() {
  // eslint-disable-next-line react/no-danger
  return <style dangerouslySetInnerHTML={{ __html: PORTAL_CSS }} />;
}

export function PortalTopBar({ active }: { active: "case" | "documents" | "messages" | "payment" | "help" }) {
  const NAV: readonly { key: typeof active; label: string; href: string }[] = [
    { key: "case", label: "My Case", href: "/portal" },
    { key: "documents", label: "Documents", href: "/portal/documents" },
    { key: "messages", label: "Messages", href: "/portal/messages" },
    { key: "payment", label: "Payment", href: "/portal/payment" },
    { key: "help", label: "Help", href: "/portal/help" },
  ];
  return (
    <div className="portal-topbar">
      <div className="portal-brand">
        <div className="portal-diamond">
          <span>R&amp;K</span>
        </div>
        <div>
          <div className="portal-brand-name">Rosenthal &amp; Kin</div>
          <div className="portal-brand-sub">Claimant Portal</div>
        </div>
      </div>
      <nav className="portal-nav">
        {NAV.map((item) => (
          <a key={item.key} href={item.href} className={active === item.key ? "active" : undefined}>
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
