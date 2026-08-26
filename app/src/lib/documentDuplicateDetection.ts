// Duplicate detection -- doc 05 section 22. PLAN.md P4-3.
//
// "Build robust duplicate detection. Detect exact duplicates using:
// Cryptographic hash, File hash, Provider ID, Upload ID. Detect
// probable duplicates using: OCR text similarity... visual
// similarity..."
//
// Scoped to the EXACT half only. Probable-duplicate detection needs
// OCR text and visual/content similarity, both blocked (P4-7/P4-9 --
// no OCR or AI provider account exists yet) -- same "don't fake what
// doesn't exist upstream" split this session used for
// communicationClassification.ts (routing logic ready, no live
// classifier yet). Exact-hash matching needs no AI at all, so it ships
// now; the probable-duplicate half is left for whenever P4-7/P4-9
// unblock.
//
// Pure logic only -- no DB access. Duplicate scope is per-estate, not
// global: doc 05 section 22 doesn't say documents from different
// estates can never be legitimately identical (a blank, unfilled form
// template could match byte-for-byte across two unrelated cases), so
// callers should pass only candidates already scoped to the same
// estate.

export interface DuplicateCandidate {
  id: string;
  fileHash: string;
}

export type DuplicateCheckResult =
  | { outcome: "UNIQUE" }
  | { outcome: "CONFIRMED_DUPLICATE"; matchingDocumentId: string };

/**
 * Pure: does this file hash already exist among the estate's other
 * documents? A byte-identical file is doc 05 section 22's strongest
 * possible signal -- no confidence score needed, it either matches or
 * it doesn't.
 */
export function detectExactDuplicate(
  newDocument: { id: string; fileHash: string | null },
  existingDocuments: readonly DuplicateCandidate[]
): DuplicateCheckResult {
  if (!newDocument.fileHash) {
    // No hash yet (e.g. computed asynchronously during ingestion) --
    // nothing to compare, not the same as "confirmed unique."
    return { outcome: "UNIQUE" };
  }

  const match = existingDocuments.find(
    (existing) => existing.id !== newDocument.id && existing.fileHash === newDocument.fileHash
  );

  if (match) {
    return { outcome: "CONFIRMED_DUPLICATE", matchingDocumentId: match.id };
  }

  return { outcome: "UNIQUE" };
}
