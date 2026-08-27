import { describe, it, expect } from "vitest";
import { validateNoteContent, EmptyNoteError } from "./notes";

describe("validateNoteContent", () => {
  it("trims and returns valid content", () => {
    expect(validateNoteContent("  Called claimant, left voicemail.  ")).toBe(
      "Called claimant, left voicemail."
    );
  });

  it("rejects empty content", () => {
    expect(() => validateNoteContent("")).toThrow(EmptyNoteError);
  });

  it("rejects whitespace-only content", () => {
    expect(() => validateNoteContent("   ")).toThrow(EmptyNoteError);
  });
});
