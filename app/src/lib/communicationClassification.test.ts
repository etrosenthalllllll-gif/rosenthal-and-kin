import { describe, it, expect } from "vitest";
import {
  routeClassifiedCommunication,
  getCategoryConfig,
  CLASSIFICATION_CATEGORIES,
  type ClassificationResult,
} from "./communicationClassification";

describe("CLASSIFICATION_CATEGORIES", () => {
  it("covers every category doc 04 section 6 lists at minimum", () => {
    const expected = [
      "INTERESTED",
      "NOT_INTERESTED",
      "QUESTION",
      "REQUEST_FOR_INFORMATION",
      "DOCUMENT_ATTACHED",
      "DOCUMENT_MISSING",
      "IDENTITY_INFORMATION",
      "RELATIONSHIP_INFORMATION",
      "CLAIM_INFORMATION",
      "LEGAL_QUESTION",
      "PAYMENT_QUESTION",
      "SUSPICIOUS",
      "WRONG_PERSON",
      "DECEASED_PERSON",
      "DO_NOT_CONTACT",
      "UNSUBSCRIBE",
      "AUTO_REPLY",
      "BOUNCE",
      "UNCLEAR",
      "ESCALATE",
    ];
    expect(Object.keys(CLASSIFICATION_CATEGORIES).sort()).toEqual(expected.sort());
  });

  it("gives every category a threshold between 0 and 1", () => {
    for (const config of Object.values(CLASSIFICATION_CATEGORIES)) {
      expect(config.confidenceThreshold).toBeGreaterThan(0);
      expect(config.confidenceThreshold).toBeLessThanOrEqual(1);
    }
  });
});

describe("getCategoryConfig", () => {
  it("returns the config for a known category", () => {
    expect(getCategoryConfig("INTERESTED")?.displayName).toBe("Interested");
  });

  it("returns null for an unknown category", () => {
    expect(getCategoryConfig("NOT_A_REAL_CATEGORY")).toBeNull();
  });
});

describe("routeClassifiedCommunication", () => {
  function result(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
    return { category: "INTERESTED", confidence: 0.95, modelVersion: "test-v1", ...overrides };
  }

  it("automates a high-confidence routine classification", () => {
    const decision = routeClassifiedCommunication(result());
    expect(decision.route).toBe("AUTOMATED");
  });

  it("routes to human review when confidence is below the category's threshold", () => {
    const decision = routeClassifiedCommunication(result({ confidence: 0.5 }));
    expect(decision.route).toBe("HUMAN_REVIEW");
    expect(decision.reason).toMatch(/below/i);
  });

  it("routes exactly-at-threshold confidence to automation (>=, not >)", () => {
    const config = getCategoryConfig("INTERESTED")!;
    const decision = routeClassifiedCommunication(
      result({ confidence: config.confidenceThreshold })
    );
    expect(decision.route).toBe("AUTOMATED");
  });

  it("never automates LEGAL_QUESTION regardless of confidence (doc 04 section 9's own example)", () => {
    const decision = routeClassifiedCommunication(
      result({ category: "LEGAL_QUESTION", confidence: 0.999 })
    );
    expect(decision.route).toBe("HUMAN_REVIEW");
  });

  it("never automates PAYMENT_QUESTION, SUSPICIOUS, DECEASED_PERSON, UNCLEAR, or ESCALATE at any confidence", () => {
    const alwaysHuman: Array<ClassificationResult["category"]> = [
      "PAYMENT_QUESTION",
      "SUSPICIOUS",
      "DECEASED_PERSON",
      "UNCLEAR",
      "ESCALATE",
    ];
    for (const category of alwaysHuman) {
      const decision = routeClassifiedCommunication(result({ category, confidence: 1.0 }));
      expect(decision.route).toBe("HUMAN_REVIEW");
    }
  });

  it("fails closed (routes to human review) on an unrecognized category rather than silently automating", () => {
    const decision = routeClassifiedCommunication({
      category: "SOMETHING_MADE_UP" as ClassificationResult["category"],
      confidence: 1.0,
      modelVersion: "test-v1",
    });
    expect(decision.route).toBe("HUMAN_REVIEW");
    expect(decision.reason).toMatch(/unrecognized/i);
  });
});
