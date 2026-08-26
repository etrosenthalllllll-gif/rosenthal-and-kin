import { describe, it, expect } from "vitest";
import { classifyDeadlineStatus, buildDeadlineRecord } from "./postFilingDeadline";

describe("deadline status classification", () => {
  it("is OVERDUE when days remaining is negative", () => {
    expect(classifyDeadlineStatus(-1)).toBe("OVERDUE");
  });

  it("is DUE_TODAY at exactly zero days remaining", () => {
    expect(classifyDeadlineStatus(0)).toBe("DUE_TODAY");
  });

  it("is DUE_SOON within the configured threshold", () => {
    expect(classifyDeadlineStatus(3)).toBe("DUE_SOON");
  });

  it("is UPCOMING beyond the threshold", () => {
    expect(classifyDeadlineStatus(10)).toBe("UPCOMING");
  });

  it("honors a custom due-soon threshold", () => {
    expect(classifyDeadlineStatus(5, 7)).toBe("DUE_SOON");
  });
});

describe("deadline record building", () => {
  it("is CONFIRMED when not extracted from ambiguous text", () => {
    const record = buildDeadlineRecord({
      source: "OFFICIAL_AUTHORITY",
      dueDate: "2026-09-10T00:00:00.000Z",
      isAmbiguous: false,
    });
    expect(record.confidence).toBe("CONFIRMED");
  });

  it("is REQUIRES_REVIEW when extracted from ambiguous text, regardless of source", () => {
    const record = buildDeadlineRecord({
      source: "CLAIMANT_COMMUNICATION",
      dueDate: "2026-09-10T00:00:00.000Z",
      isAmbiguous: true,
    });
    expect(record.confidence).toBe("REQUIRES_REVIEW");
  });

  it("preserves the calculation inputs on the resulting record", () => {
    const record = buildDeadlineRecord({
      source: "FILING_RULE",
      dueDate: "2026-09-10T00:00:00.000Z",
      ruleId: "response-deadline-v2",
      ruleVersion: "2",
      triggerDate: "2026-08-01T00:00:00.000Z",
      calculationDescription: "Notice received Aug 1; response due within 40 days.",
      isAmbiguous: false,
    });
    expect(record.ruleId).toBe("response-deadline-v2");
    expect(record.triggerDate).toBe("2026-08-01T00:00:00.000Z");
  });
});
