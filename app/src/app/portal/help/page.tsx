import { requirePortalSession } from "@/lib/requirePortalSession";
import { PortalStyles, PortalTopBar } from "../portalUi";

export const dynamic = "force-dynamic";

export default async function PortalHelpPage() {
  await requirePortalSession();

  return (
    <main className="portal-page">
      <PortalStyles />
      <PortalTopBar active="help" />
      <h1 className="portal-h1">Need help?</h1>
      <p className="portal-sub">Questions about your case, the process, or the documents we&apos;re asking for?</p>

      <div className="portal-card">
        <div className="portal-card-title">Contact your case handler</div>
        <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6 }}>
          Message your case handler directly from the <a href="/portal/messages">Messages</a> tab, or email{" "}
          <a href="mailto:ethan@rosenthalandkin.com">ethan@rosenthalandkin.com</a>.
        </p>
      </div>

      <div className="portal-card">
        <div className="portal-card-title">Common questions</div>
        <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.7 }}>
          <b>Will I be charged anything up front?</b> No -- you are never charged unless and until funds are actually
          recovered.
          <br />
          <br />
          <b>How long does this take?</b> Once your documents are complete, most cases file with the county within
          1&ndash;2 weeks, and recovery typically follows in 60&ndash;120 days depending on the county&apos;s
          schedule.
          <br />
          <br />
          <b>Is my information secure?</b> Your case page is only reachable through your own private access link --
          it isn&apos;t publicly listed or searchable.
        </p>
      </div>
    </main>
  );
}
