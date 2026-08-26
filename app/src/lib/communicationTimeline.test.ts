import { describe, it, expect } from "vitest";
import {
  buildCommunicationTimeline,
  type CommunicationTimelineRow,
} from "./communicationTimeline";

function row(overrides: Partial<CommunicationTimelineRow> = {}): CommunicationTimelineRow {
  return {
    id: "comm-1",
    channel: "EMAIL",
    direction: "INBOUND",
    sender: "jane@example.com",
    recipient: "outreach@rosenthalandkin.com",
    subject: "Re: Estate of John Smith",
    body: "Yes, I'm interested. What do you need from me?",
    status: "RECEIVED",
    classification: null,
    classificationConfidence: null,
    aiSummary: null,
    aiConfidence: null,
    createdAt: new Date("2026-01-12T10:00:00Z"),
    conversation: { id: "conv-1", attentionStatus: "AUTOMATED", humanHandling: false },
    ...overrides,
  };
}

describe("buildCommunicationTimeline", () => {
  it("sorts chronologically, oldest first", () => {
    const rows = [
      row({ id: "c3", createdAt: new Date("2026-01-18T00:00:00Z") }),
      row({ id: "c1", createdAt: new Date("2026-01-04T00:00:00Z") }),
      row({ id: "c2", createdAt: new Date("2026-01-12T00:00:00Z") }),
    ];
    const timeline = buildCommunicationTimeline(rows);
    expect(timeline.map((t) => t.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("uses the AI summary as the display summary when one exists", () => {
    const timeline = buildCommunicationTimeline([
      row({ aiSummary: "Claimant confirms relationship and asks about next steps." }),
    ]);
    expect(timeline[0].displaySummary).toBe(
      "Claimant confirms relationship and asks about next steps."
    );
  });

  it("falls back to a truncated body when no AI summary exists yet", () => {
    const timeline = buildCommunicationTimeline([
      row({ aiSummary: null, body: "Yes, I'm interested. What do you need from me?" }),
    ]);
    expect(timeline[0].displaySummary).toBe("Yes, I'm interested. What do you need from me?");
  });

  it("truncates a long body rather than dumping the whole message inline", () => {
    const longBody = "A".repeat(300);
    const timeline = buildCommunicationTimeline([row({ aiSummary: null, body: longBody })]);
    expect(timeline[0].displaySummary.length).toBeLessThanOrEqual(140);
    expect(timeline[0].displaySummary.endsWith("…")).toBe(true);
  });

  it("marks a message as requiring attention when its conversation isn't AUTOMATED", () => {
    const timeline = buildCommunicationTimeline([
      row({ conversation: { id: "conv-1", attentionStatus: "OPERATOR_REQUIRED", humanHandling: false } }),
    ]);
    expect(timeline[0].requiresAttention).toBe(true);
  });

  it("does not mark a routine AUTOMATED-conversation message as requiring attention", () => {
    const timeline = buildCommunicationTimeline([row()]);
    expect(timeline[0].requiresAttention).toBe(false);
  });

  it("surfaces humanHandling from the conversation independent of attentionStatus", () => {
    const timeline = buildCommunicationTimeline([
      row({ conversation: { id: "conv-1", attentionStatus: "AUTOMATED", humanHandling: true } }),
    ]);
    expect(timeline[0].humanHandling).toBe(true);
  });
});
