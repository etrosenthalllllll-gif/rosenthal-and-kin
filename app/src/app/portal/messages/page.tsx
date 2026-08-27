import { prisma } from "@/lib/db";
import { requirePortalSession } from "@/lib/requirePortalSession";
import { PortalStyles, PortalTopBar } from "../portalUi";

export const dynamic = "force-dynamic";

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function PortalMessagesPage({
  searchParams,
}: {
  searchParams: { messageOk?: string; messageError?: string };
}) {
  const claimant = await requirePortalSession();

  const conversation = await prisma.conversation.findFirst({
    where: { claimantId: claimant.id, channel: "PORTAL" },
    include: { communications: { orderBy: { createdAt: "asc" } } },
  });
  const messages = conversation?.communications ?? [];

  return (
    <main className="portal-page">
      <PortalStyles />
      <PortalTopBar active="messages" />
      <h1 className="portal-h1">Messages</h1>
      <p className="portal-sub">Message your case handler directly -- they&apos;ll see this in their queue.</p>

      {searchParams.messageOk && <div className="portal-notice ok">Message sent.</div>}
      {searchParams.messageError && <div className="portal-notice error">Message couldn&apos;t be sent -- it was empty.</div>}

      <div className="portal-card">
        {messages.length === 0 ? (
          <p style={{ color: "var(--dim)", fontSize: 13 }}>No messages yet -- say hello below.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`portal-msg ${m.direction === "INBOUND" ? "me" : "them"}`}>
              {m.body}
              <div className="portal-msg-meta">
                {m.direction === "INBOUND" ? "You" : "Rosenthal & Kin"} &middot; {formatTimestamp(m.createdAt)}
              </div>
            </div>
          ))
        )}
        <form action="/api/portal/messages" method="POST" style={{ marginTop: 14 }}>
          <textarea name="body" className="portal-msg-input" placeholder="Write a message…" required />
          <button type="submit" className="portal-btn portal-btn-secondary">
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
