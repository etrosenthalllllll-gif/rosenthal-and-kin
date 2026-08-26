// Declaration/document generation -- doc 07 sections 20-22. PLAN.md P6-10.
//
// "Generate declarations, cover letters, exhibit indexes, and claim
// summaries from versioned templates. Every factual statement in a
// generated document must trace back to verified case data or
// evidence. Where AI-assisted drafting is used, always store the
// original draft, the final version, and require human approval --
// never let the system freely invent legal language."
//
// **Owner-approved-override status, same as engagementAgreement.ts
// (P2-2) / claimTypes.ts (P6-2)**: the template bodies below are
// placeholder/example content, not attorney-reviewed legal language.
// Nothing generated here should be sent to a claimant or filed with a
// court without human review and real legal sourcing.
//
// Template rendering only fills in placeholders from CaseFact entries
// explicitly marked `verified` -- an unverified or missing fact blocks
// generation entirely (fails closed) rather than asserting an
// unconfirmed fact as though it were established, per doc 07 §21's own
// instruction. The draft/revision/approval history mirrors
// humanHandoff.ts's (P3-8) MessageRevisionHistory shape exactly:
// immutable, original-never-overwritten, a new record produced on each
// revision -- same discipline, applied to documents instead of
// messages.

export type GeneratedDocumentType = "DECLARATION" | "COVER_LETTER" | "EXHIBIT_INDEX" | "CLAIM_SUMMARY";

export interface DocumentTemplate {
  id: string;
  version: number;
  documentType: GeneratedDocumentType;
  jurisdiction?: string;
  bodyTemplate: string; // contains {{casePath}} placeholders
  requiredCasePaths: readonly string[];
  supersedes?: string;
  status: "EXAMPLE_PENDING_LEGAL_SOURCING" | "ATTORNEY_REVIEWED";
}

export interface CaseFact {
  casePath: string;
  value: string;
  // Only a fact traced back to verified case data/evidence may be
  // asserted in a generated document -- doc 07 §21's explicit
  // requirement. An unverified fact behaves exactly like a missing one
  // for generation purposes.
  verified: boolean;
}

export type DocumentGenerationStatus = "GENERATED" | "MISSING_REQUIRED_DATA" | "UNVERIFIED_DATA";

export interface DocumentGenerationResult {
  documentType: GeneratedDocumentType;
  templateId: string;
  status: DocumentGenerationStatus;
  bodyText: string | null;
  missingCasePaths: string[];
  unverifiedCasePaths: string[];
}

/**
 * Pure: doc 07 sections 20-22. Renders a versioned template against
 * the case facts supplied, but only when every required case path is
 * both present AND verified -- a required-but-unverified fact blocks
 * generation the same as a missing one, since asserting an unverified
 * fact as established is exactly what this module must never do.
 */
export function generateDocumentFromTemplate(
  template: DocumentTemplate,
  facts: readonly CaseFact[]
): DocumentGenerationResult {
  const factByPath = new Map(facts.map((f) => [f.casePath, f]));

  const missingCasePaths = template.requiredCasePaths.filter((p) => !factByPath.has(p));
  const unverifiedCasePaths = template.requiredCasePaths.filter((p) => {
    const fact = factByPath.get(p);
    return fact != null && !fact.verified;
  });

  if (missingCasePaths.length > 0) {
    return {
      documentType: template.documentType,
      templateId: template.id,
      status: "MISSING_REQUIRED_DATA",
      bodyText: null,
      missingCasePaths,
      unverifiedCasePaths,
    };
  }

  if (unverifiedCasePaths.length > 0) {
    return {
      documentType: template.documentType,
      templateId: template.id,
      status: "UNVERIFIED_DATA",
      bodyText: null,
      missingCasePaths: [],
      unverifiedCasePaths,
    };
  }

  const bodyText = template.bodyTemplate.replace(/\{\{(.+?)\}\}/g, (_match, path: string) => {
    const fact = factByPath.get(path.trim());
    return fact ? fact.value : `{{${path}}}`;
  });

  return {
    documentType: template.documentType,
    templateId: template.id,
    status: "GENERATED",
    bodyText,
    missingCasePaths: [],
    unverifiedCasePaths: [],
  };
}

// --- Draft/revision/approval history --------------------------------
//
// Mirrors humanHandoff.ts's MessageRevisionHistory exactly: the
// original draft is never overwritten, each revision produces a new
// record, and a document isn't final until explicitly approved.

export interface DocumentRevisionHistory {
  originalDraft: string;
  operatorRevision: string | null;
  approvedFinalVersion: string | null;
}

export function createDocumentDraftHistory(originalDraft: string): DocumentRevisionHistory {
  return { originalDraft, operatorRevision: null, approvedFinalVersion: null };
}

export function applyDocumentRevision(
  history: DocumentRevisionHistory,
  revisedText: string
): DocumentRevisionHistory {
  return { ...history, operatorRevision: revisedText };
}

/**
 * doc 07 section 22: "require human approval" before a generated
 * document is treated as final -- this is the one place a version
 * becomes the approved final text, and it always requires an explicit
 * call, never inferred from a revision being present.
 */
export function approveFinalDocument(
  history: DocumentRevisionHistory,
  finalText: string
): DocumentRevisionHistory {
  return { ...history, approvedFinalVersion: finalText };
}
