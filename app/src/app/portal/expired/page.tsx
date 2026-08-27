// Landing page for an unauthenticated /portal visit -- an expired,
// already-used-up, or simply nonexistent access link, or a signed-out
// session. Claimants never have a password, so there's no login form
// here to fall back to -- only a way to ask for a new link.
import { PortalStyles } from "../portalUi";

export default function PortalExpiredPage() {
  return (
    <main className="portal-page" style={{ maxWidth: 460, margin: "12vh auto" }}>
      <PortalStyles />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, justifyContent: "center" }}>
        <div
          style={{
            width: 36,
            height: 36,
            border: "1.5px solid var(--navy)",
            transform: "rotate(45deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ transform: "rotate(-45deg)", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 12, color: "var(--navy)" }}>
            R&amp;K
          </span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 18, fontFamily: "'Playfair Display', serif", color: "var(--navy)" }}>
          Rosenthal &amp; Kin
        </div>
      </div>
      <div className="portal-card" style={{ textAlign: "center" }}>
        <div className="portal-card-title" style={{ justifyContent: "center" }}>
          Link expired or invalid
        </div>
        <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6 }}>
          This access link is no longer valid. Contact your case handler and ask for a new one --
          you don&apos;t need a password to access your case, just a fresh link.
        </p>
      </div>
    </main>
  );
}
