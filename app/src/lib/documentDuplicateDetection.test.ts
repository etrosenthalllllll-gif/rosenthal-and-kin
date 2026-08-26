import { describe, it, expect } from "vitest";
import { detectExactDuplicate } from "./documentDuplicateDetection";

describe("detectExactDuplicate", () => {
  it("returns UNIQUE when no other document shares the hash", () => {
    const result = detectExactDuplicate(
      { id: "new", fileHash: "abc123" },
      [{ id: "other", fileHash: "def456" }]
    );
    expect(result).toEqual({ outcome: "UNIQUE" });
  });

  it("returns CONFIRMED_DUPLICATE when another document has the same hash", () => {
    const result = detectExactDuplicate(
      { id: "new", fileHash: "abc123" },
      [{ id: "existing-doc", fileHash: "abc123" }]
    );
    expect(result).toEqual({ outcome: "CONFIRMED_DUPLICATE", matchingDocumentId: "existing-doc" });
  });

  it("does not treat a document as its own duplicate", () => {
    const result = detectExactDuplicate(
      { id: "same-id", fileHash: "abc123" },
      [{ id: "same-id", fileHash: "abc123" }]
    );
    expect(result).toEqual({ outcome: "UNIQUE" });
  });

  it("returns UNIQUE when the hash isn't computed yet, rather than falsely confirming uniqueness as a fact", () => {
    const result = detectExactDuplicate(
      { id: "new", fileHash: null },
      [{ id: "existing-doc", fileHash: "abc123" }]
    );
    expect(result).toEqual({ outcome: "UNIQUE" });
  });

  it("picks the first matching document when multiple hash collisions exist", () => {
    const result = detectExactDuplicate(
      { id: "new", fileHash: "abc123" },
      [
        { id: "first", fileHash: "abc123" },
        { id: "second", fileHash: "abc123" },
      ]
    );
    expect(result).toEqual({ outcome: "CONFIRMED_DUPLICATE", matchingDocumentId: "first" });
  });
});
