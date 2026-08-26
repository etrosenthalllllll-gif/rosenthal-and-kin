import { describe, it, expect } from "vitest";
import { planPostFilingEscalationDecision } from "./postFilingDecisionRouting";
import { evaluateEscalation } from "./postFilingEscalation";

describe("post-filing escalation decision routing", () => {
  it("returns no decision when nothing escalated", () => {
    const escalation = evaluateEscalation([]);
    expect(planPostFilingEscalationDecision("case-1", escalation)).toBeNull();
  });

  it("recommends a decision when the case escalates above Normal", () => {
    const escalation = evaluateEscalation(["DEADLINE_APPROACHING"]);
    const result = planPostFilingEscalationDecision("case-1", escalation);
    expect(result?.decisionTypeKey).toBe("REVIEW_POST_FILING_EXCEPTION");
    expect(result?.reason).toContain("level 1");
    expect(result?.evidenceRefs).toContain("case-1");
  });

  it("names every fired trigger in the reason", () => {
    const escalation = evaluateEscalation(["SYSTEM_ERROR", "DEADLINE_OVERDUE"]);
    const result = planPostFilingEscalationDecision("case-1", escalation);
    expect(result?.reason).toContain("SYSTEM_ERROR");
    expect(result?.reason).toContain("DEADLINE_OVERDUE");
  });
});
