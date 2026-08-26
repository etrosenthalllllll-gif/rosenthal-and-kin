import { describe, it, expect } from "vitest";
import {
  classifyConflictSeverity,
  explainConflict,
  type ConflictInput,
} from "./conflictDetection";

function input(overrides: Partial<ConflictInput> = {}): ConflictInput {
  return {
    field: "DATE_OF_BIRTH",
    sourceAId: "birth-cert",
    sourceAValue: "01/02/1981",
    sourceBId: "passport",
    sourceBValue: "01/02/1982",
    ...overrides,
  };
}

describe("classifyConflictSeverity", () => {
  it("classifies a name variation as LOW (doc 06's own example)", () => {
    expect(classifyConflictSeverity("NAME")).toBe("LOW");
  });

  it("classifies an identity conflict as HIGH (doc 06's own example)", () => {
    expect(classifyConflictSeverity("IDENTITY")).toBe("HIGH");
  });

  it("classifies a parent-relationship conflict as CRITICAL", () => {
    expect(classifyConflictSeverity("PARENT_RELATIONSHIP")).toBe("CRITICAL");
  });

  it("fails closed to CRITICAL for an unconfigured field rather than defaulting to LOW", () => {
    // OTHER isn't in DEFAULT_FIELD_SEVERITY at all
    expect(classifyConflictSeverity("OTHER")).toBe("CRITICAL");
  });
});

describe("explainConflict", () => {
  it("includes what/sources/why/possible-explanations/next-step, per doc 06 sec 16", () => {
    const result = explainConflict(input());
    expect(result.whatConflicted).toMatch(/01\/02\/1981/);
    expect(result.whatConflicted).toMatch(/01\/02\/1982/);
    expect(result.whyItMatters.length).toBeGreaterThan(0);
    expect(result.possibleExplanations.length).toBeGreaterThan(0);
    expect(result.recommendedNextStep.length).toBeGreaterThan(0);
  });

  it("never asserts a single explanation as fact -- always a list of possibilities", () => {
    const result = explainConflict(input({ field: "IDENTITY" }));
    expect(Array.isArray(result.possibleExplanations)).toBe(true);
    expect(result.possibleExplanations.length).toBeGreaterThan(1);
  });

  it("requires human review for HIGH and CRITICAL severity", () => {
    expect(explainConflict(input({ field: "IDENTITY" })).requiresHumanReview).toBe(true);
    expect(explainConflict(input({ field: "PARENT_RELATIONSHIP" })).requiresHumanReview).toBe(
      true
    );
  });

  it("does not require human review for LOW/MEDIUM severity", () => {
    expect(explainConflict(input({ field: "NAME" })).requiresHumanReview).toBe(false);
    expect(explainConflict(input({ field: "DATE_OF_BIRTH" })).requiresHumanReview).toBe(false);
  });
});
