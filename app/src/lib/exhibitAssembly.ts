// Exhibit assembly, eligibility, indexing, numbering, page tracking --
// doc 07 sections 23-28. PLAN.md P6-11.
//
// "Build a deterministic ordered-exhibit assembler from eligible
// documents. A document is eligible only if it's the correct type,
// belongs to the correct case, has been validated, and is not
// superseded or a confirmed duplicate. Auto-generate an exhibit index
// and page map. Numbering (alphabetical, numerical, or custom) must be
// deterministic and must never collide on regeneration."
//
// Pure logic only, same discipline as everything else in this phase --
// given the same input documents and scheme, this always produces the
// identical numbering/page map, so re-running it never collides with
// or silently renumbers a prior assembly.

export interface ExhibitCandidateDocument {
  id: string;
  caseId: string;
  documentType: string;
  validationStatus: "NOT_VALIDATED" | "VALID" | "INVALID" | "INCOMPLETE" | "UNCERTAIN";
  duplicateStatus: "NOT_CHECKED" | "UNIQUE" | "LIKELY_DUPLICATE" | "CONFIRMED_DUPLICATE";
  isSuperseded?: boolean;
  pageCount: number;
}

export type ExhibitIneligibleReason =
  | "WRONG_CASE"
  | "NOT_VALIDATED"
  | "CONFIRMED_DUPLICATE"
  | "SUPERSEDED";

/**
 * doc 07 section 23: a document is exhibit-eligible only if it's the
 * correct case, validated (not merely received), and neither a
 * confirmed duplicate nor superseded by a later version.
 */
export function checkExhibitEligibility(
  doc: ExhibitCandidateDocument,
  caseId: string
): { eligible: boolean; reason?: ExhibitIneligibleReason } {
  if (doc.caseId !== caseId) return { eligible: false, reason: "WRONG_CASE" };
  if (doc.duplicateStatus === "CONFIRMED_DUPLICATE") return { eligible: false, reason: "CONFIRMED_DUPLICATE" };
  if (doc.isSuperseded) return { eligible: false, reason: "SUPERSEDED" };
  if (doc.validationStatus !== "VALID") return { eligible: false, reason: "NOT_VALIDATED" };
  return { eligible: true };
}

export type ExhibitNumberingScheme = "ALPHABETICAL" | "NUMERICAL" | "CUSTOM";

export interface ExhibitAssemblyInput {
  documents: readonly ExhibitCandidateDocument[];
  caseId: string;
  scheme: ExhibitNumberingScheme;
  // Required (and must list every eligible document exactly once) when
  // scheme is CUSTOM -- document ids in the desired exhibit order.
  customOrder?: readonly string[];
}

export interface ExhibitEntry {
  documentId: string;
  label: string;
  startPage: number;
  endPage: number;
}

export interface ExcludedExhibitDocument {
  documentId: string;
  reason: ExhibitIneligibleReason;
}

export type ExhibitAssemblyStatus = "OK" | "MISSING_CUSTOM_ORDER";

export interface ExhibitAssemblyResult {
  status: ExhibitAssemblyStatus;
  entries: ExhibitEntry[];
  excluded: ExcludedExhibitDocument[];
  totalPages: number;
}

function alphabeticalLabel(index: number): string {
  // A, B, C, ... Z, AA, AB, ... -- same scheme as spreadsheet columns,
  // so it never runs out or collides regardless of exhibit count.
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return `Exhibit ${label}`;
}

function orderEligibleDocuments(
  eligible: readonly ExhibitCandidateDocument[],
  scheme: ExhibitNumberingScheme,
  customOrder?: readonly string[]
): ExhibitCandidateDocument[] | null {
  if (scheme === "CUSTOM") {
    if (!customOrder) return null;
    const byId = new Map(eligible.map((d) => [d.id, d]));
    const ordered = customOrder.map((id) => byId.get(id)).filter((d): d is ExhibitCandidateDocument => d != null);
    return ordered;
  }

  // ALPHABETICAL and NUMERICAL both order deterministically by
  // documentType then id -- "alphabetical" governs the label style
  // (letters vs. numbers), not a different sort key, so the same input
  // always produces the same order regardless of scheme.
  return [...eligible].sort((a, b) => {
    const typeCompare = a.documentType.localeCompare(b.documentType);
    return typeCompare !== 0 ? typeCompare : a.id.localeCompare(b.id);
  });
}

/**
 * Pure: doc 07 sections 23-28. Filters to eligible documents, orders
 * them per the requested scheme, and produces a deterministic exhibit
 * index with a running page map. CUSTOM without a customOrder fails
 * closed (MISSING_CUSTOM_ORDER) rather than silently falling back to
 * another scheme.
 */
export function buildExhibitAssembly(input: ExhibitAssemblyInput): ExhibitAssemblyResult {
  const excluded: ExcludedExhibitDocument[] = [];
  const eligible: ExhibitCandidateDocument[] = [];

  for (const doc of input.documents) {
    const check = checkExhibitEligibility(doc, input.caseId);
    if (check.eligible) {
      eligible.push(doc);
    } else if (check.reason) {
      excluded.push({ documentId: doc.id, reason: check.reason });
    }
  }

  const ordered = orderEligibleDocuments(eligible, input.scheme, input.customOrder);
  if (ordered == null) {
    return { status: "MISSING_CUSTOM_ORDER", entries: [], excluded, totalPages: 0 };
  }

  let page = 1;
  const entries: ExhibitEntry[] = ordered.map((doc, index) => {
    const startPage = page;
    const endPage = page + Math.max(doc.pageCount, 1) - 1;
    page = endPage + 1;
    return {
      documentId: doc.id,
      label: input.scheme === "ALPHABETICAL" ? alphabeticalLabel(index) : `Exhibit ${index + 1}`,
      startPage,
      endPage,
    };
  });

  return {
    status: "OK",
    entries,
    excluded,
    totalPages: page - 1,
  };
}
