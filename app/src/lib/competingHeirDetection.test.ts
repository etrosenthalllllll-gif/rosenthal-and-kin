import { describe, it, expect } from "vitest";
import {
  assessCompetingHeirCandidate,
  classifyNegativeEvidence,
} from "./competingHeirDetection";

describe("assessCompetingHeirCandidate", () => {
  it("returns LOW/POTENTIAL for no signals at all", () => {
    const result = assessCompetingHeirCandidate({ personId: "p1", signals: [] });
    expect(result.confidence).toBe("LOW");
    expect(result.status).toBe("POTENTIAL");
  });

  it("never flags a shared surname alone as anything but LOW (doc 06 sec 23)", () => {
    const result = assessCompetingHeirCandidate({
      personId: "p1",
      signals: ["SHARED_SURNAME"],
    });
    expect(result.confidence).toBe("LOW");
    expect(result.status).toBe("POTENTIAL");
  });

  it("raises to MEDIUM/REQUIRES_REVIEW with two corroborating signals (name + DOB + address example)", () => {
    const result = assessCompetingHeirCandidate({
      personId: "p1",
      signals: ["SHARED_SURNAME", "MATCHING_DOB"],
    });
    expect(result.confidence).toBe("MEDIUM");
    expect(result.status).toBe("REQUIRES_REVIEW");
  });

  it("treats a document explicitly naming the relationship as HIGH regardless of other signals", () => {
    const result = assessCompetingHeirCandidate({
      personId: "p1",
      signals: ["DOCUMENT_NAMES_RELATIONSHIP"],
    });
    expect(result.confidence).toBe("HIGH");
    expect(result.status).toBe("REQUIRES_REVIEW");
  });

  it("never assigns CONFIRMED_BY_OPERATOR or RULED_OUT -- those are human/workflow transitions only", () => {
    const result = assessCompetingHeirCandidate({
      personId: "p1",
      signals: ["DOCUMENT_NAMES_RELATIONSHIP", "MATCHING_DOB", "SHARED_ADDRESS"],
    });
    expect(["POTENTIAL", "REQUIRES_REVIEW"]).toContain(result.status);
  });
});

describe("classifyNegativeEvidence", () => {
  it("returns NO_EVIDENCE_FOUND when a source simply doesn't mention something", () => {
    expect(classifyNegativeEvidence(false)).toBe("NO_EVIDENCE_FOUND");
  });

  it("returns EVIDENCE_OF_ABSENCE only when a source explicitly addresses the question", () => {
    expect(classifyNegativeEvidence(true)).toBe("EVIDENCE_OF_ABSENCE");
  });
});
