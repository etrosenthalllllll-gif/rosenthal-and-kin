import { describe, it, expect } from "vitest";
import { isValidEventSourceReference, detectDateConflict } from "./postFilingDocumentConflict";

describe("event source reference validation", () => {
  it("is valid with a document id and extracted text", () => {
    expect(isValidEventSourceReference({ documentId: "doc-1", extractedText: "Hearing scheduled Sept 10." })).toBe(
      true
    );
  });

  it("is invalid with an empty document id", () => {
    expect(isValidEventSourceReference({ documentId: "", extractedText: "text" })).toBe(false);
  });

  it("is invalid with empty extracted text", () => {
    expect(isValidEventSourceReference({ documentId: "doc-1", extractedText: "" })).toBe(false);
  });
});

describe("date conflict detection", () => {
  it("reports no conflict when the dates agree", () => {
    const result = detectDateConflict("EVENT_CONFLICT", "2026-09-10", "2026-09-10");
    expect(result.hasConflict).toBe(false);
    expect(result.requiresHumanReview).toBe(false);
  });

  it("reports an EVENT_CONFLICT and requires review, never overwriting silently", () => {
    const result = detectDateConflict("EVENT_CONFLICT", "2026-09-10", "2026-09-17");
    expect(result.hasConflict).toBe(true);
    expect(result.conflictType).toBe("EVENT_CONFLICT");
    expect(result.previousValue).toBe("2026-09-10");
    expect(result.newValue).toBe("2026-09-17");
    expect(result.requiresHumanReview).toBe(true);
  });

  it("reports a DEADLINE_CONFLICT rather than auto-choosing between two sources", () => {
    const result = detectDateConflict("DEADLINE_CONFLICT", "2026-09-10", "2026-09-12");
    expect(result.conflictType).toBe("DEADLINE_CONFLICT");
    expect(result.requiresHumanReview).toBe(true);
  });

  it("no conflict when neither source has a value yet", () => {
    const result = detectDateConflict("DEADLINE_CONFLICT", null, null);
    expect(result.hasConflict).toBe(false);
  });
});
