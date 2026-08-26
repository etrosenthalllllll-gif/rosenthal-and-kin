import { describe, it, expect } from "vitest";
import { detectStuckWorkflow, detectStuckCase, evaluateCaseSla } from "./stuckDetection";

describe("stuck workflow detection", () => {
  it("matches the doc's own worked example (claim prep expected <2h, actual 18h)", () => {
    const event = detectStuckWorkflow({
      caseId: "RK-1842",
      workflowId: "wf-claim-prep",
      currentStep: "Document validation",
      startedAt: "2026-08-26T00:00:00.000Z",
      now: "2026-08-26T18:00:00.000Z",
      expectedDurationMs: 2 * 60 * 60 * 1000,
      recommendedAction: "Check document validation provider",
    });
    expect(event?.caseId).toBe("RK-1842");
    expect(event?.currentStep).toBe("Document validation");
  });

  it("returns null when the workflow is within its expected duration", () => {
    const event = detectStuckWorkflow({
      caseId: "RK-1842",
      workflowId: "wf-claim-prep",
      currentStep: "Document validation",
      startedAt: "2026-08-26T00:00:00.000Z",
      now: "2026-08-26T00:30:00.000Z",
      expectedDurationMs: 2 * 60 * 60 * 1000,
    });
    expect(event).toBeNull();
  });
});

describe("stuck case detection", () => {
  it("matches the doc's own worked example (CLAIM_REVIEW expected 48h, actual 7 days)", () => {
    const alert = detectStuckCase({
      caseId: "RK-1842",
      currentState: "CLAIM_REVIEW",
      stateEnteredAt: "2026-08-19T00:00:00.000Z",
      now: "2026-08-26T00:00:00.000Z",
      expectedTransitionMs: 48 * 60 * 60 * 1000,
    });
    expect(alert?.currentState).toBe("CLAIM_REVIEW");
  });
});

describe("case SLA monitoring", () => {
  it("reports WITHIN_SLA with time remaining before the target", () => {
    const report = evaluateCaseSla(5 * 60 * 60 * 1000, 48 * 60 * 60 * 1000, { responsibleWorkflow: "CLAIM_REVIEW" });
    expect(report.status).toBe("WITHIN_SLA");
    expect(report.timeRemainingMs).toBe(43 * 60 * 60 * 1000);
    expect(report.timeExceededMs).toBeNull();
  });

  it("reports SLA_EXCEEDED with time exceeded past the target", () => {
    const report = evaluateCaseSla(50 * 60 * 60 * 1000, 48 * 60 * 60 * 1000);
    expect(report.status).toBe("SLA_EXCEEDED");
    expect(report.timeExceededMs).toBe(2 * 60 * 60 * 1000);
    expect(report.timeRemainingMs).toBeNull();
  });
});
