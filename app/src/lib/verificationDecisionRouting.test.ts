import { describe, it, expect } from "vitest";
import {
  planIdentityVerificationDecision,
  planRelationshipVerificationDecision,
  planCompetingHeirDecision,
} from "./verificationDecisionRouting";

describe("planIdentityVerificationDecision", () => {
  it("returns null for a clean LIKELY_SAME_PERSON match", () => {
    const result = planIdentityVerificationDecision("p1", "p2", {
      outcome: "LIKELY_SAME_PERSON",
      matchScore: 0.95,
      matchingEvidence: [],
    });
    expect(result).toBeNull();
  });

  it("recommends RESOLVE_IDENTITY_VERIFICATION for POSSIBLE_MATCH", () => {
    const result = planIdentityVerificationDecision("p1", "p2", {
      outcome: "POSSIBLE_MATCH",
      matchScore: 0.5,
      matchingEvidence: [],
    });
    expect(result?.decisionTypeKey).toBe("RESOLVE_IDENTITY_VERIFICATION");
    expect(result?.evidenceRefs).toEqual(["p1", "p2"]);
  });

  it("returns null for INSUFFICIENT_EVIDENCE -- not yet a match claim to resolve", () => {
    const result = planIdentityVerificationDecision("p1", "p2", {
      outcome: "INSUFFICIENT_EVIDENCE",
      matchScore: 0.1,
      matchingEvidence: [],
    });
    expect(result).toBeNull();
  });
});

describe("planRelationshipVerificationDecision", () => {
  it("returns null when the claim doesn't require review", () => {
    const result = planRelationshipVerificationDecision("claim-1", {
      status: "SUPPORTED",
      requiresHumanReview: false,
      independentSupportingCount: 2,
      contradictingCount: 0,
      reason: "supported",
    });
    expect(result).toBeNull();
  });

  it("recommends RESOLVE_RELATIONSHIP_VERIFICATION when CONFLICTED", () => {
    const result = planRelationshipVerificationDecision("claim-1", {
      status: "CONFLICTED",
      requiresHumanReview: true,
      independentSupportingCount: 1,
      contradictingCount: 1,
      reason: "conflicting evidence",
    });
    expect(result?.decisionTypeKey).toBe("RESOLVE_RELATIONSHIP_VERIFICATION");
    expect(result?.evidenceRefs).toEqual(["claim-1"]);
  });
});

describe("planCompetingHeirDecision", () => {
  it("returns null for a POTENTIAL (not yet review-worthy) candidate", () => {
    const result = planCompetingHeirDecision({
      personId: "p1",
      status: "POTENTIAL",
      confidence: "LOW",
      signals: [],
      reason: "no signals",
    });
    expect(result).toBeNull();
  });

  it("recommends REVIEW_COMPETING_HEIR_CANDIDATE when REQUIRES_REVIEW", () => {
    const result = planCompetingHeirDecision({
      personId: "p1",
      status: "REQUIRES_REVIEW",
      confidence: "HIGH",
      signals: ["DOCUMENT_NAMES_RELATIONSHIP"],
      reason: "document explicitly names the relationship",
    });
    expect(result?.decisionTypeKey).toBe("REVIEW_COMPETING_HEIR_CANDIDATE");
    expect(result?.evidenceRefs).toEqual(["p1"]);
  });
});
