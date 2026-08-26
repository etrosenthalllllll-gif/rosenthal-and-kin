import { describe, it, expect } from "vitest";
import {
  buildOutboxEntry,
  markOutboxDelivered,
  buildInboxEntry,
  evaluateInboxIntake,
  markInboxProcessed,
  needsReconciliationTask,
  attachCorrelationId,
  buildCaseTimeline,
} from "./dataConsistency";

describe("outbox pattern", () => {
  it("starts undelivered and marking delivered returns a new object", () => {
    const entry = buildOutboxEntry("evt-1", { type: "CLAIM_FILED" }, "2026-08-26T00:00:00.000Z");
    expect(entry.delivered).toBe(false);
    const delivered = markOutboxDelivered(entry);
    expect(delivered.delivered).toBe(true);
    expect(entry.delivered).toBe(false); // original untouched
  });
});

describe("inbox pattern", () => {
  it("stores and processes a never-seen external event", () => {
    expect(evaluateInboxIntake("ext-1", new Set())).toBe("STORE_AND_PROCESS");
  });

  it("ignores a duplicate external event", () => {
    expect(evaluateInboxIntake("ext-1", new Set(["ext-1"]))).toBe("DUPLICATE_IGNORED");
  });

  it("marks an inbox entry processed without mutating the original", () => {
    const entry = buildInboxEntry("ext-1", {}, "2026-08-26T00:00:00.000Z");
    const processed = markInboxProcessed(entry);
    expect(processed.processed).toBe(true);
    expect(entry.processed).toBe(false);
  });
});

describe("reconciliation task trigger", () => {
  it("needs a reconciliation task when the external call and internal update disagree", () => {
    expect(needsReconciliationTask(true, false)).toBe(true);
    expect(needsReconciliationTask(false, true)).toBe(true);
  });

  it("needs no reconciliation task when both succeeded or both failed", () => {
    expect(needsReconciliationTask(true, true)).toBe(false);
    expect(needsReconciliationTask(false, false)).toBe(false);
  });
});

describe("event correlation", () => {
  it("attaches a correlation id without losing the original fields", () => {
    const event = attachCorrelationId({ eventType: "CLAIM_FILED" }, "corr-1");
    expect(event.eventType).toBe("CLAIM_FILED");
    expect(event.correlationId).toBe("corr-1");
  });
});

describe("cross-system case timeline", () => {
  it("merges and sorts entries from different systems chronologically", () => {
    const timeline = buildCaseTimeline([
      { system: "Filing system", description: "Filing submitted", timestamp: "2026-08-20T00:00:00.000Z" },
      { system: "Case system", description: "Case created", timestamp: "2026-08-01T00:00:00.000Z" },
      { system: "Financial system", description: "Payment received", timestamp: "2026-08-25T00:00:00.000Z" },
    ]);
    expect(timeline.map((t) => t.system)).toEqual(["Case system", "Filing system", "Financial system"]);
  });
});
