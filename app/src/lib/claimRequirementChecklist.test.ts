import { describe, it, expect } from "vitest";
import {
  buildClaimRequirementChecklist,
  isClaimChecklistComplete,
  type ClaimRequirementCandidate,
} from "./claimRequirementChecklist";
import type { ClaimRule } from "./claimRules";

const RULES: readonly ClaimRule[] = [
  {
    id: "general-rule",
    version: 1,
    jurisdiction: "CA",
    claimType: "ESTATE_CLAIM",
    outcome: {
      requiredDocumentTypes: ["IDENTIFICATION", "DEATH_CERTIFICATE"],
      requiredFormIds: ["ESTATE_CLAIM_FORM"],
      requiredSignatures: ["CLAIMANT"],
      requiredDeclarations: ["CLAIMANT_DECLARATION"],
      requiredExhibits: ["DEATH_CERTIFICATE"],
    },
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "rep-rule",
    version: 1,
    jurisdiction: "CA",
    claimType: "ESTATE_CLAIM",
    claimantType: "ESTATE_REPRESENTATIVE",
    outcome: {
      requiredDocumentTypes: ["LETTERS_OF_ADMINISTRATION"],
      requiredFormIds: [],
      requiredSignatures: [],
      requiredDeclarations: [],
      requiredExhibits: [],
    },
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
];

describe("claim requirement checklist", () => {
  it("marks a requirement MISSING when no candidate document exists", () => {
    const items = buildClaimRequirementChecklist("CA", "ESTATE_CLAIM", undefined, {}, RULES);
    const identity = items.find((i) => i.category === "DOCUMENT" && i.key === "IDENTIFICATION");
    expect(identity?.status).toBe("MISSING");
  });

  it("traces a requirement back to the rule that created it", () => {
    const items = buildClaimRequirementChecklist("CA", "ESTATE_CLAIM", undefined, {}, RULES);
    const identity = items.find((i) => i.category === "DOCUMENT" && i.key === "IDENTIFICATION");
    expect(identity?.sourceRuleIds).toContain("general-rule");
  });

  it("conditional requirement (estate representative) only appears for that claimant type", () => {
    const withRep = buildClaimRequirementChecklist("CA", "ESTATE_CLAIM", "ESTATE_REPRESENTATIVE", {}, RULES);
    expect(withRep.some((i) => i.key === "LETTERS_OF_ADMINISTRATION")).toBe(true);

    const withoutRep = buildClaimRequirementChecklist("CA", "ESTATE_CLAIM", undefined, {}, RULES);
    expect(withoutRep.some((i) => i.key === "LETTERS_OF_ADMINISTRATION")).toBe(false);
  });

  it("a validated candidate satisfies its requirement", () => {
    const candidates: ClaimRequirementCandidate[] = [{ id: "doc-1", key: "IDENTIFICATION", status: "VALIDATED" }];
    const items = buildClaimRequirementChecklist("CA", "ESTATE_CLAIM", undefined, { DOCUMENT: candidates }, RULES);
    const identity = items.find((i) => i.key === "IDENTIFICATION");
    expect(identity?.status).toBe("VALIDATED");
    expect(identity?.matchingCandidateIds).toEqual(["doc-1"]);
  });

  it("a confirmed duplicate never counts toward satisfying a requirement", () => {
    const candidates: ClaimRequirementCandidate[] = [
      { id: "doc-1", key: "IDENTIFICATION", status: "VALIDATED", isConfirmedDuplicate: true },
    ];
    const items = buildClaimRequirementChecklist("CA", "ESTATE_CLAIM", undefined, { DOCUMENT: candidates }, RULES);
    expect(items.find((i) => i.key === "IDENTIFICATION")?.status).toBe("MISSING");
  });

  it("CONFLICTED wins even when a verified candidate exists for the same requirement", () => {
    const candidates: ClaimRequirementCandidate[] = [
      { id: "doc-1", key: "DEATH_CERTIFICATE", status: "VERIFIED" },
      { id: "doc-2", key: "DEATH_CERTIFICATE", status: "CONFLICTED" },
    ];
    const items = buildClaimRequirementChecklist("CA", "ESTATE_CLAIM", undefined, { DOCUMENT: candidates }, RULES);
    expect(items.find((i) => i.key === "DEATH_CERTIFICATE")?.status).toBe("CONFLICTED");
  });

  it("isClaimChecklistComplete is false while anything is MISSING", () => {
    const items = buildClaimRequirementChecklist("CA", "ESTATE_CLAIM", undefined, {}, RULES);
    expect(isClaimChecklistComplete(items)).toBe(false);
  });

  it("isClaimChecklistComplete is true once every item is VALIDATED or VERIFIED", () => {
    const candidates: Record<string, ClaimRequirementCandidate[]> = {
      DOCUMENT: [
        { id: "d1", key: "IDENTIFICATION", status: "VALIDATED" },
        { id: "d2", key: "DEATH_CERTIFICATE", status: "VERIFIED" },
      ],
      FORM: [{ id: "f1", key: "ESTATE_CLAIM_FORM", status: "VALIDATED" }],
      SIGNATURE: [{ id: "s1", key: "CLAIMANT", status: "VERIFIED" }],
      DECLARATION: [{ id: "dec1", key: "CLAIMANT_DECLARATION", status: "VALIDATED" }],
      EXHIBIT: [{ id: "e1", key: "DEATH_CERTIFICATE", status: "VALIDATED" }],
    };
    const items = buildClaimRequirementChecklist("CA", "ESTATE_CLAIM", undefined, candidates, RULES);
    expect(isClaimChecklistComplete(items)).toBe(true);
  });
});
