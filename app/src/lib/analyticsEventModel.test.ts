import { describe, it, expect } from "vitest";
import { buildAnalyticsEvent, EXAMPLE_ANALYTICS_EVENT_TYPES } from "./analyticsEventModel";

describe("analytics event construction", () => {
  it("builds an event with full attribution", () => {
    const event = buildAnalyticsEvent("CLAIM_FILED", "2026-08-26T00:00:00.000Z", {
      caseId: "RK-1842",
      source: "Source A",
      campaign: "Q3 Outreach",
      costCents: 500,
    });
    expect(event.eventType).toBe("CLAIM_FILED");
    expect(event.caseId).toBe("RK-1842");
    expect(event.costCents).toBe(500);
  });

  it("builds an event with no attribution at all", () => {
    const event = buildAnalyticsEvent("WORKFLOW_STARTED", "2026-08-26T00:00:00.000Z");
    expect(event.eventType).toBe("WORKFLOW_STARTED");
    expect(event.caseId).toBeUndefined();
  });
});

describe("example analytics event catalog", () => {
  it("includes the doc's own worked examples", () => {
    expect(EXAMPLE_ANALYTICS_EVENT_TYPES).toContain("LEAD_CREATED");
    expect(EXAMPLE_ANALYTICS_EVENT_TYPES).toContain("RECOVERY_RECEIVED");
  });
});
