import { describe, it, expect } from "vitest";
import { generateEngagementAgreement, type EngagementAgreementInput } from "./engagementAgreement";

const baseInput: EngagementAgreementInput = {
  jurisdiction: "CA",
  assetSource: "PROBATE_ESTATE",
  claimantName: "Jane Smith",
  decedentName: "John Smith",
  caseNumber: "RK-1",
  estimatedRecoveryCents: 100_000_00,
  proposedFeeCents: 10_000_00,
  agreementDate: "2026-08-25",
};

describe("generateEngagementAgreement", () => {
  it("drafts agreement text for a CA probate estate even though the fee can't be auto-cleared", () => {
    const result = generateEngagementAgreement(baseInput);
    expect(result.agreementText).not.toBeNull();
    expect(result.agreementText).toContain("Jane Smith");
    expect(result.agreementText).toContain("John Smith");
    expect(result.agreementText).toContain("RK-1");
  });

  it("never allows advancing to Engaged for a probate estate (case-by-case court standard, not a fixed cap)", () => {
    const result = generateEngagementAgreement(baseInput);
    expect(result.canAdvanceToEngaged).toBe(false);
    expect(result.feeCompliance.action).toBe("BLOCK_AND_ESCALATE");
  });

  it("includes the probate disclosure rule's citation in the draft", () => {
    const result = generateEngagementAgreement(baseInput);
    expect(result.agreementText).toContain("Cal. Prob. Code § 11604.5");
  });

  it("records which rule versions backed the draft", () => {
    const result = generateEngagementAgreement(baseInput);
    const citations = result.rulesUsed.map((r) => r.citation);
    expect(citations).toContain("Cal. Prob. Code § 11604.5");
    expect(citations).toContain("Cal. Prob. Code § 11604");
    for (const rule of result.rulesUsed) {
      expect(rule.lastReviewedDate).toBeTruthy();
    }
  });

  it("never claims a rescission right that wasn't verified", () => {
    const result = generateEngagementAgreement(baseInput);
    expect(result.agreementText).toContain("none identified in the verified statutory sources");
  });

  it("allows advancing to Engaged for an unclaimed-property case within the verified 10% cap", () => {
    const result = generateEngagementAgreement({
      ...baseInput,
      assetSource: "STATE_CONTROLLER_UNCLAIMED_PROPERTY",
      proposedFeeCents: 5_000_00, // 5%, within the 10% cap
    });
    expect(result.canAdvanceToEngaged).toBe(true);
    expect(result.feeCompliance.action).toBe("PROCEED");
    expect(result.agreementText).toContain("Cal. Code Civ. Proc. § 1582");
  });

  it("blocks an unclaimed-property case whose fee exceeds the verified 10% cap", () => {
    const result = generateEngagementAgreement({
      ...baseInput,
      assetSource: "STATE_CONTROLLER_UNCLAIMED_PROPERTY",
      proposedFeeCents: 20_000_00, // 20%, over the cap
    });
    expect(result.canAdvanceToEngaged).toBe(false);
    expect(result.feeCompliance.action).toBe("BLOCK_AND_ESCALATE");
    // Still drafts the text (fee cap rule exists), just can't advance.
    expect(result.agreementText).not.toBeNull();
  });

  it("returns null agreement text when no rule at all exists for the jurisdiction", () => {
    const result = generateEngagementAgreement({ ...baseInput, jurisdiction: "NY" });
    expect(result.agreementText).toBeNull();
    expect(result.canAdvanceToEngaged).toBe(false);
    expect(result.rulesUsed).toEqual([]);
  });
});
