import { describe, it, expect } from "vitest";
import {
  applyDecisionAction,
  applyApproveClaimantDecision,
  MissingRequiredCommentError,
  UnavailableActionError,
} from "./decisionWorkflow";
import { InvalidDecisionTransitionError } from "./decisionStatus";
import { InvalidClaimantTransitionError } from "./stateMachine";
import { DECISION_TYPES } from "./decisionTypes";

describe("applyDecisionAction", () => {
  it("applies SEND on APPROVE_OUTREACH and resolves to APPROVED", () => {
    const result = applyDecisionAction({
      decisionType: "APPROVE_OUTREACH",
      currentStatus: "PENDING",
      action: "SEND",
    });
    expect(result.newStatus).toBe("APPROVED");
  });

  it("applies ESCALATE from PENDING and resolves to ESCALATED", () => {
    const result = applyDecisionAction({
      decisionType: "APPROVE_OUTREACH",
      currentStatus: "PENDING",
      action: "ESCALATE",
    });
    expect(result.newStatus).toBe("ESCALATED");
  });

  it("rejects an action not configured for the decision type", () => {
    expect(() =>
      applyDecisionAction({
        decisionType: "APPROVE_OUTREACH",
        currentStatus: "PENDING",
        action: "APPROVE_AND_FILE", // only valid on APPROVE_CLAIM_PACKAGE
      })
    ).toThrow(UnavailableActionError);
  });

  it("requires a comment for decision types configured to need one", () => {
    expect(() =>
      applyDecisionAction({
        decisionType: "APPROVE_CLAIM_PACKAGE",
        currentStatus: "PENDING",
        action: "APPROVE_AND_FILE",
        // no reason provided
      })
    ).toThrow(MissingRequiredCommentError);
  });

  it("succeeds with a comment on a type that requires one", () => {
    const result = applyDecisionAction({
      decisionType: "APPROVE_CLAIM_PACKAGE",
      currentStatus: "PENDING",
      action: "APPROVE_AND_FILE",
      reason: "All documents verified, no conflicts.",
    });
    expect(result.newStatus).toBe("APPROVED");
  });

  it("rejects a resulting transition that isn't legal for the current decision status", () => {
    expect(() =>
      applyDecisionAction({
        decisionType: "APPROVE_OUTREACH",
        currentStatus: "APPROVED", // already resolved -- terminal-adjacent
        action: "SEND",
      })
    ).toThrow(InvalidDecisionTransitionError);
  });

  it("throws for a genuinely unknown decision type", () => {
    expect(() =>
      applyDecisionAction({
        decisionType: "NOT_REAL",
        currentStatus: "PENDING",
        action: "SEND",
      })
    ).toThrow();
  });

  // Regression test for a real bug: several exception-lane actions
  // (RESOLVE, DEFER, CLOSE, RETRY, CREATE_NEW_CASE, KEEP_NEW,
  // KEEP_EXISTING, KEEP_BOTH, RESEARCH, RULE_OUT, YES, NO) were
  // configured as availableActions on DECISION_TYPES but had no entry
  // in ACTION_STATUS_MAP -- every one of those buttons would have
  // thrown "no status mapping defined" the first time an operator
  // actually clicked it. This sweeps the whole registry so a newly
  // added decision type can never reintroduce the gap silently.
  it("has a status mapping for every action referenced anywhere in the decision-type registry", () => {
    for (const config of Object.values(DECISION_TYPES)) {
      for (const action of config.availableActions) {
        expect(() =>
          applyDecisionAction({
            decisionType: config.key,
            currentStatus: "PENDING",
            action,
            reason: config.requiresComment ? "test reason" : undefined,
          })
        ).not.toThrow();
      }
    }
  });
});

describe("applyApproveClaimantDecision (decision <-> claimant wiring)", () => {
  it("approving verifies the claimant, moving POTENTIAL_HEIR -> VERIFIED", () => {
    const result = applyApproveClaimantDecision({
      currentDecisionStatus: "PENDING",
      currentClaimantStatus: "POTENTIAL_HEIR",
      action: "APPROVE",
      reason: "Identity and relationship both source-supported.",
    });
    expect(result.newStatus).toBe("APPROVED");
    expect(result.claimantStatus).toBe("VERIFIED");
  });

  it("rejecting does NOT touch the claimant's lifecycle state", () => {
    const result = applyApproveClaimantDecision({
      currentDecisionStatus: "PENDING",
      currentClaimantStatus: "POTENTIAL_HEIR",
      action: "REJECT",
      reason: "Relationship evidence conflicts with prior record.",
    });
    expect(result.newStatus).toBe("REJECTED");
    expect(result.claimantStatus).toBe("POTENTIAL_HEIR"); // unchanged
  });

  it("escalating does NOT touch the claimant's lifecycle state", () => {
    const result = applyApproveClaimantDecision({
      currentDecisionStatus: "PENDING",
      currentClaimantStatus: "POTENTIAL_HEIR",
      action: "ESCALATE",
      reason: "Ambiguous identity match, needs supervisor review.",
    });
    expect(result.claimantStatus).toBe("POTENTIAL_HEIR");
  });

  it("refuses to approve-and-verify a claimant in a state where VERIFIED isn't reachable", () => {
    // e.g. a claimant that's already FILED shouldn't be able to be
    // "verified" again via a stray decision approval.
    expect(() =>
      applyApproveClaimantDecision({
        currentDecisionStatus: "PENDING",
        currentClaimantStatus: "FILED",
        action: "APPROVE",
        reason: "test",
      })
    ).toThrow(InvalidClaimantTransitionError);
  });

  it("still requires the comment doc 02 mandates for this decision type", () => {
    expect(() =>
      applyApproveClaimantDecision({
        currentDecisionStatus: "PENDING",
        currentClaimantStatus: "POTENTIAL_HEIR",
        action: "APPROVE",
      })
    ).toThrow(MissingRequiredCommentError);
  });
});
