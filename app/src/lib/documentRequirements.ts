// Document requirements engine + missing-document detection + checklist
// -- doc 05 sections 19, 20, 21. PLAN.md P4-2.
//
// "Build a configurable requirements engine. Different workflows/case
// stages may require different documents... Do not hardcode these
// requirements into UI components." / "Automatically determine which
// required documents are missing... Create a workflow/task." / "Build a
// case document checklist."
//
// Config-table pattern, same as complianceRules.ts / decisionTypes.ts /
// communicationClassification.ts: the requirements themselves live in a
// versioned table, not a switch statement. Pure logic only -- callers
// supply the case's current documents (already fetched from Prisma);
// this module doesn't touch the DB.

// doc 05 section 7's classification taxonomy, scoped to the subset the
// requirements engine below actually references. The doc explicitly
// says "make document types configurable" and "do not hardcode the
// entire classification taxonomy" -- this list can grow without
// touching the logic functions below.
export type DocumentType =
  | "BIRTH_CERTIFICATE"
  | "DEATH_CERTIFICATE"
  | "MARRIAGE_CERTIFICATE"
  | "DIVORCE_DECREE"
  | "PROBATE_DOCUMENT"
  | "COURT_DOCUMENT"
  | "WILL"
  | "TRUST_DOCUMENT"
  | "ESTATE_DOCUMENT"
  | "IDENTIFICATION"
  | "DRIVER_LICENSE"
  | "PASSPORT"
  | "SOCIAL_SECURITY_DOCUMENT"
  | "ADDRESS_VERIFICATION"
  | "BANK_FINANCIAL_DOCUMENT"
  | "TAX_DOCUMENT"
  | "GENEALOGY_RECORD"
  | "FAMILY_TREE"
  | "CORRESPONDENCE"
  | "CLAIM_FORM"
  | "AUTHORIZATION"
  | "AFFIDAVIT"
  | "LEGAL_FILING"
  | "UNKNOWN"
  | "OTHER";

// doc 05 section 19's own example stages, verbatim.
export type ClaimWorkflowStage = "CLAIMANT_VERIFICATION" | "CLAIM_PREPARATION" | "CLAIM_FILING";

export interface DocumentRequirement {
  key: string;
  displayName: string;
  // Any document of one of these types satisfies the requirement --
  // e.g. either a driver's license or a passport satisfies "Identity."
  satisfiedByAnyOf: readonly DocumentType[];
  required: boolean;
}

// doc 05 section 19's worked example, taken as the literal starting
// requirements set -- CLAIMANT_VERIFICATION needs identity + proof of
// relationship; CLAIM_PREPARATION adds authorization; CLAIM_FILING
// needs the complete package plus signatures. "Other configured
// documents" per stage is deliberately left to grow this table, not to
// be special-cased in code.
export const DOCUMENT_REQUIREMENTS: Record<ClaimWorkflowStage, readonly DocumentRequirement[]> = {
  CLAIMANT_VERIFICATION: [
    {
      key: "IDENTITY",
      displayName: "Identity",
      satisfiedByAnyOf: ["IDENTIFICATION", "DRIVER_LICENSE", "PASSPORT"],
      required: true,
    },
    {
      key: "PROOF_OF_RELATIONSHIP",
      displayName: "Proof of Relationship",
      satisfiedByAnyOf: ["BIRTH_CERTIFICATE", "MARRIAGE_CERTIFICATE", "DIVORCE_DECREE"],
      required: true,
    },
  ],
  CLAIM_PREPARATION: [
    {
      key: "IDENTITY",
      displayName: "Identity",
      satisfiedByAnyOf: ["IDENTIFICATION", "DRIVER_LICENSE", "PASSPORT"],
      required: true,
    },
    {
      key: "RELATIONSHIP_EVIDENCE",
      displayName: "Relationship Evidence",
      satisfiedByAnyOf: ["BIRTH_CERTIFICATE", "MARRIAGE_CERTIFICATE", "DIVORCE_DECREE"],
      required: true,
    },
    {
      key: "AUTHORIZATION",
      displayName: "Authorization",
      satisfiedByAnyOf: ["AUTHORIZATION"],
      required: true,
    },
  ],
  CLAIM_FILING: [
    {
      key: "CLAIM_FORM",
      displayName: "Completed Claim Form",
      satisfiedByAnyOf: ["CLAIM_FORM"],
      required: true,
    },
    {
      key: "SUPPORTING_EVIDENCE",
      displayName: "Required Supporting Evidence",
      satisfiedByAnyOf: [
        "BIRTH_CERTIFICATE",
        "DEATH_CERTIFICATE",
        "MARRIAGE_CERTIFICATE",
        "DIVORCE_DECREE",
        "PROBATE_DOCUMENT",
      ],
      required: true,
    },
    {
      key: "AUTHORIZATION",
      displayName: "Authorization",
      satisfiedByAnyOf: ["AUTHORIZATION"],
      required: true,
    },
  ],
};

// What the requirements engine needs to know about each of the case's
// existing documents -- deliberately a small, explicit shape rather
// than the full Prisma Document row, so this module stays independent
// of the schema and testable with plain objects.
export interface RequirementCandidateDocument {
  id: string;
  documentType: DocumentType;
  // "Received" alone isn't "satisfied" -- doc 05 section 15: "Do not
  // treat 'document exists' as equivalent to 'document is valid.'"
  validationStatus: "NOT_VALIDATED" | "VALID" | "INVALID" | "INCOMPLETE" | "UNCERTAIN";
  duplicateStatus: "NOT_CHECKED" | "UNIQUE" | "LIKELY_DUPLICATE" | "CONFIRMED_DUPLICATE";
}

export type ChecklistItemStatus =
  | "SATISFIED" // received, validated, not a duplicate
  | "RECEIVED_UNVALIDATED" // matching document exists but hasn't cleared validation yet
  | "MISSING"; // no matching, non-duplicate document exists at all

export interface ChecklistItem {
  requirement: DocumentRequirement;
  status: ChecklistItemStatus;
  // The document(s) that satisfy or partially satisfy this
  // requirement, so the UI/checklist can link straight to them (doc 05
  // section 21: "Each requirement should link to: Supporting
  // document...").
  matchingDocumentIds: string[];
}

function isUsableCandidate(doc: RequirementCandidateDocument): boolean {
  // A confirmed duplicate doesn't count toward satisfying a
  // requirement -- doc 05 section 22: the duplicate is preserved as a
  // record but shouldn't silently double-count as evidence.
  return doc.duplicateStatus !== "CONFIRMED_DUPLICATE";
}

/**
 * Pure: builds the doc 05 section 21 checklist for one case at one
 * workflow stage, given its existing documents.
 */
export function buildDocumentChecklist(
  stage: ClaimWorkflowStage,
  documents: readonly RequirementCandidateDocument[]
): ChecklistItem[] {
  const requirements = DOCUMENT_REQUIREMENTS[stage];

  return requirements.map((requirement) => {
    const matches = documents.filter(
      (doc) => isUsableCandidate(doc) && requirement.satisfiedByAnyOf.includes(doc.documentType)
    );

    if (matches.length === 0) {
      return { requirement, status: "MISSING", matchingDocumentIds: [] };
    }

    const validated = matches.filter((doc) => doc.validationStatus === "VALID");
    if (validated.length > 0) {
      return {
        requirement,
        status: "SATISFIED",
        matchingDocumentIds: validated.map((doc) => doc.id),
      };
    }

    return {
      requirement,
      status: "RECEIVED_UNVALIDATED",
      matchingDocumentIds: matches.map((doc) => doc.id),
    };
  });
}

/**
 * Pure: doc 05 section 20's missing-document detection -- just the
 * required, unsatisfied subset of the checklist. Every one of these is
 * a candidate for an automated DOCUMENT_REQUEST (section 42), handled
 * by whatever calls this, not by this module.
 */
export function detectMissingDocuments(checklist: readonly ChecklistItem[]): ChecklistItem[] {
  return checklist.filter((item) => item.requirement.required && item.status === "MISSING");
}

/**
 * Pure: true only when every required item on the checklist is
 * SATISFIED. RECEIVED_UNVALIDATED does not count -- doc 05 section 15's
 * "existence isn't validity" applies here too.
 */
export function isChecklistComplete(checklist: readonly ChecklistItem[]): boolean {
  return checklist
    .filter((item) => item.requirement.required)
    .every((item) => item.status === "SATISFIED");
}
