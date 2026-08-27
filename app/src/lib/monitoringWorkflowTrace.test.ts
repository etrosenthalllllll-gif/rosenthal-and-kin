import { describe, it, expect } from "vitest";
import { buildDetailedWorkflowTrace, buildSystemTimeline } from "./monitoringWorkflowTrace";

describe("detailed workflow trace", () => {
  it("matches the doc's own worked example (submit filing -> timeout -> retry -> success)", () => {
    const trace = buildDetailedWorkflowTrace([
      {
        eventType: "SUBMIT_FILING",
        timestamp: "2026-08-26T00:00:00.000Z",
        detail: { step: "Submit filing", api: "Provider X", result: "Timeout" },
      },
      {
        eventType: "RETRY_SUBMIT_FILING",
        timestamp: "2026-08-26T00:01:00.000Z",
        detail: { step: "Submit filing", api: "Provider X", result: "Success", retryAttempt: 2, providerReference: "XYZ123" },
      },
    ]);
    expect(trace).toHaveLength(2);
    expect(trace[0].detail?.result).toBe("Timeout");
    expect(trace[1].detail?.providerReference).toBe("XYZ123");
  });

  it("is chronologically ordered even when events arrive out of order", () => {
    const trace = buildDetailedWorkflowTrace([
      { eventType: "B", timestamp: "2026-08-26T00:02:00.000Z" },
      { eventType: "A", timestamp: "2026-08-26T00:01:00.000Z" },
    ]);
    expect(trace.map((t) => t.label)).toEqual(["A", "B"]);
  });
});

describe("system timeline", () => {
  it("delegates to dataConsistency.ts's buildCaseTimeline()", () => {
    const timeline = buildSystemTimeline([
      { system: "Filing system", description: "Filing submitted", timestamp: "2026-08-26T00:02:00.000Z" },
      { system: "Case system", description: "Case created", timestamp: "2026-08-26T00:00:00.000Z" },
    ]);
    expect(timeline.map((t) => t.system)).toEqual(["Case system", "Filing system"]);
  });
});
