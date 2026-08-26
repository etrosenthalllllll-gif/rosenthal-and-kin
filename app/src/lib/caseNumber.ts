// Case identification -- doc 01 Phase 3.
//
// "Case numbers should be human-readable and safe to expose internally."
// "Do not rely exclusively on names because names can collide."

const CASE_NUMBER_PREFIX = "RK";

export function formatCaseNumber(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error(`Case sequence must be a positive integer, got ${sequence}`);
  }
  return `${CASE_NUMBER_PREFIX}-${sequence}`;
}

// --- Duplicate-estate detection -------------------------------------------
//
// Matching signal is normalized decedent name + jurisdiction, with the
// probate case number (when both estates have one) as a strong override --
// two different-looking names sharing the exact same court case number are
// almost certainly the same estate (e.g. a typo'd or nickname'd entry).

export interface EstateDuplicateCandidate {
  id: string;
  decedentName: string;
  jurisdiction: string;
  probateCaseNumber?: string | null;
}

// Strips combining diacritical marks (U+0300-U+036F) left behind after
// NFKD normalization, so "Jose" and "José" compare equal.
const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9\s]/g, "") // strip remaining punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export function isSameProbateCase(
  a: EstateDuplicateCandidate,
  b: EstateDuplicateCandidate
): boolean {
  return Boolean(
    a.probateCaseNumber &&
      b.probateCaseNumber &&
      a.probateCaseNumber.trim().toLowerCase() === b.probateCaseNumber.trim().toLowerCase()
  );
}

export function isNameAndJurisdictionMatch(
  a: EstateDuplicateCandidate,
  b: EstateDuplicateCandidate
): boolean {
  return (
    normalizeName(a.decedentName) === normalizeName(b.decedentName) &&
    a.jurisdiction.trim().toLowerCase() === b.jurisdiction.trim().toLowerCase()
  );
}

/**
 * Returns every existing estate that looks like it might be the same
 * estate as `candidate`. This never auto-merges anything -- per doc 01,
 * a suspected duplicate must be surfaced for operator review, not
 * silently resolved. Caller decides what "surfaced" means (a Decision,
 * an exception, a blocked create -- whatever the API layer wants).
 */
export function findDuplicateEstates(
  existing: EstateDuplicateCandidate[],
  candidate: EstateDuplicateCandidate
): EstateDuplicateCandidate[] {
  return existing.filter(
    (e) =>
      e.id !== candidate.id &&
      (isSameProbateCase(e, candidate) || isNameAndJurisdictionMatch(e, candidate))
  );
}
