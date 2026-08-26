// Case workspace: communication history timeline -- doc 04 sections
// 24-25, 45. PLAN.md P3-12.
//
// "Build a unified communication timeline for every case... The
// operator should be able to understand the entire relationship with
// the person from one timeline." / "Build a communication section
// inside the case workspace... Allow filtering by channel."
//
// This is the first real "case workspace" page this project has --
// everything before it lived in the flat /ops decision queue. Scoped
// tightly to what doc 04 actually asks for here (the timeline itself,
// filterable by channel) rather than building out claim-prep/document
// sections that belong to later phases. Reads real data via
// fetchCommunicationTimeline() (P3-1) -- currently renders an honest
// empty state, since no live Communication rows exist yet (no inbound
// provider is wired up -- P3-3/P3-9 note this is credential-blocked).

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/requireSession";
import {
  fetchCommunicationTimeline,
  type CommunicationChannel,
  type CommunicationTimelineItem,
} from "@/lib/communicationTimeline";

export const dynamic = "force-dynamic";

const CHANNELS: readonly CommunicationChannel[] = ["EMAIL", "SMS", "VOICE", "MAIL"];

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
        border: item.requiresAttention ? "1px solid #fca5a5" : "1px solid #e5e7eb",
        background: item.requiresAttention ? "#fef2f2" : undefined,
        borderRadius: 8,
        padding: "0.875rem 1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#4b5563",
              border: "1px solid #d1d5db",
              borderRadius: 4,
              padding: "0.05rem 0.4rem",
            }}
          >
            {item.channel}
          </span>
          <span style={{ fontSize: "0.8rem", color: item.direction === "INBOUND" ? "#1d4ed8" : "#6b7280" }}>
            {item.direction === "INBOUND" ? "↓ inbound" : "↑ outbound"}
          </span>
          {item.humanHandling && (
            <span style={{ fontSize: "0.7rem", color: "#b45309" }}>· operator handling</span>
          )}
        </div>
        <span style={{ fontSize: "0.8rem", color: "#6b7280", whiteSpace: "nowrap" }}>
          {formatTimestamp(item.createdAt)}
        </span>
      </div>
      {item.subject && (
        <div style={{ fontWeight: 600, marginTop: "0.35rem" }}>{item.subject}</div>
      )}
      <div style={{ marginTop: "0.25rem", color: "#374151" }}>{item.displaySummary}</div>
      <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "#6b7280" }}>
        {item.sender} → {item.recipient}
        {item.classification && <> · classified as {item.classification}</>}
        {item.requiresAttention && (
          <span style={{ color: "#b91c1c", fontWeight: 600 }}> · requires attention</span>
        )}
      </div>
    </li>
  );
}

export default async function CaseWorkspacePage({
  params,
  searchParams,
}: {
  params: { claimantId: string };
  searchParams: { channel?: string };
}) {
  const user = await requireSession();

  const claimant = await prisma.claimant.findUnique({
    where: { id: params.claimantId },
    include: { person: true, estate: true },
  });

  if (!claimant) {
    notFound();
  }

  const timeline = await fetchCommunicationTimeline(prisma, claimant.id);
  const channelFilter = searchParams.channel;
  const filtered =
    channelFilter && CHANNELS.includes(channelFilter as CommunicationChannel)
      ? timeline.filter((item) => item.channel === channelFilter)
      : timeline;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <a href="/ops" style={{ fontSize: "0.8rem", color: "#1d4ed8" }}>
            ← Decision Queue
          </a>
          <h1 style={{ margin: "0.25rem 0" }}>
            {claimant.person.firstName} {claimant.person.lastName}
          </h1>
          <div style={{ color: "#6b7280" }}>
            {claimant.estate.decedentName} ({claimant.estate.caseNumber}) · {claimant.status}
          </div>
        </div>
        <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>{user.name}</div>
      </div>

      <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem" }}>Communication history</h2>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <a
          href={`/ops/cases/${claimant.id}`}
          style={{
            fontSize: "0.8rem",
            padding: "0.2rem 0.6rem",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            color: channelFilter ? "#374151" : "#1d4ed8",
            fontWeight: channelFilter ? 400 : 700,
          }}
        >
          All
        </a>
        {CHANNELS.map((channel) => (
          <a
            key={channel}
            href={`/ops/cases/${claimant.id}?channel=${channel}`}
            style={{
              fontSize: "0.8rem",
              padding: "0.2rem 0.6rem",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              color: channelFilter === channel ? "#1d4ed8" : "#374151",
              fontWeight: channelFilter === channel ? 700 : 400,
            }}
          >
            {channel}
          </a>
        ))}
      </div>

      {timeline.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          No communications recorded yet. (Expected right now -- no live inbound provider is wired
          up yet; see PLAN.md P3-3/P3-9.)
        </p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No {channelFilter} communications for this case.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {filtered.map((item) => (
            <TimelineRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}
