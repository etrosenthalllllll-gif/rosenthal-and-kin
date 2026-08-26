import { describe, it, expect } from "vitest";
import { planApprovalGate, isApprovalExpired, evaluateApprovalDependencies } from "./approvalGate";

describe("planning an approval gate", () => {
  it("pulls availableActions from the decision-type registry, not a hand-typed list", () => {
    const planned = planApprovalGate({
      decisionType: "APPROVE_DISTRIBUTION",
      claimantId: "claimant-1",
      aiRecommendation: "APPROVE",
      aiConfidence: 97,
      deadline: "2026-08-28T00:00:00.000Z",
    });
    expect(planned.availableActions).toEqual(["APPROVE", "REVISE", "REJECT", "ESCALATE"]);
    expect(planned.status).toBe("PENDING");
  });

  it("throws on an unknown decision type rather than silently defaulting", () => {
    expect(() => planApprovalGate({ decisionType: "NOT_A_TYPE", claimantId: "c1" })).toThrow();
  });
});

describe("approval expiration", () => {
  it("is not expired when there's no deadline", () => {
    expect(isApprovalExpired({ status: "PENDING" }, "2026-08-26T00:00:00.000Z")).toBe(false);
  });

  it("is not expired while the deadline is still in the future", () => {
    expect(
      isApprovalExpired({ status: "PENDING", deadline: "2026-08-30T00:00:00.000Z" }, "2026-08-26T00:00:00.000Z")
    ).toBe(false);
  });

  it("is expired once the deadline has passed and the decision is still open", () => {
    expect(
      isApprovalExpired({ status: "PENDING", deadline: "2026-08-01T00:00:00.000Z" }, "2026-08-26T00:00:00.000Z")
    ).toBe(true);
  });

  it("is never expired for a decision that already reached a final status", () => {
    expect(
      isApprovalExpired({ status: "APPROVED", deadline: "2026-08-01T00:00:00.000Z" }, "2026-08-26T00:00:00.000Z")
    ).toBe(false);
  });
});

describe("multi-approval dependencies", () => {
  it("reports ALL_APPROVED only once every member has approved", () => {
    const result = evaluateApprovalDependencies([
      { id: "a", status: "APPROVED" },
      { id: "b", status: "APPROVED" },
    ]);
    expect(result.outcome).toBe("ALL_APPROVED");
  });

  it("reports AWAITING_APPROVALS while some are still pending", () => {
    const result = evaluateApprovalDependencies([
      { id: "a", status: "APPROVED" },
      { id: "b", status: "PENDING" },
    ]);
    expect(result.outcome).toBe("AWAITING_APPROVALS");
  });

  it("is BLOCKED by a single rejection even if every other approval passed", () => {
    const result = evaluateApprovalDependencies([
      { id: "a", status: "APPROVED" },
      { id: "b", status: "REJECTED" },
    ]);
    expect(result.outcome).toBe("BLOCKED");
    expect(result.blockedBy).toEqual(["b"]);
  });
});
