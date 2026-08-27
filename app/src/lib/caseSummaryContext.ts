// Wires caseSummary.ts's (P1-3) already-built, already-tested
// generateCaseSummary() to real data for the first time -- that module
// was deliberately left unwired because nothing produced real document/
// competing-heir counts yet. The Document model (P4-1) and PotentialHeir
// model (schema, doc 06 groundwork) now exist, so this builds the real
// input from them rather than continuing to defer.
//
// Same pure/thin-wrapper split as the rest of this codebase:
// buildCaseSummaryInput() is pure and testable with plain fixtures;
// fetchCaseSummaryInput() does the actual Prisma reads.

import type { PrismaClient } from "@prisma/client";
import {
  buildDocumentChecklist,
  detectMissingDocuments,
  type RequirementCandidateDocument,
} from "./documentRequirements";
import type { CaseSummaryInput } from "./caseSummary";

export interface CaseSummaryContextInputs {
  decedentName: string;
  claimantFirstName: string;
  claimantLastName: string;
  claimantStatus: string;
  estimatedValueCents: number | null;
  documents: readonly RequirementCandidateDocument[];
  competingHeirCount: number;
}

/**
 * Pure: turns raw case facts into the CaseSummaryInput contract
 * caseSummary.ts already defines. Uses the CLAIMANT_VERIFICATION stage
 * checklist -- the earliest stage every claimant passes through -- as
 * the baseline "what's required/received/missing" view; a later stage's
 * checklist would need the claimant's actual current stage threaded in,
 * which is a reasonable follow-on refinement rather than a blocker here.
 */
export function buildCaseSummaryInput(inputs: CaseSummaryContextInputs): CaseSummaryInput {
  const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", inputs.documents);
  const missing = detectMissingDocuments(checklist);

  return {
    decedentName: inputs.decedentName,
    claimantName: `${inputs.claimantFirstName} ${inputs.claimantLastName}`,
    claimantStatus: inputs.claimantStatus,
    estimatedValueCents: inputs.estimatedValueCents,
    documentsReceived: inputs.documents.length,
    documentsRequired: checklist.filter((item) => item.requirement.required).length,
    missingDocumentTypes: missing.map((item) => item.requirement.displayName),
    competingHeirCount: inputs.competingHeirCount,
  };
}

/**
 * Fetches everything buildCaseSummaryInput() needs for one claimant.
 * Not unit-tested for the same reason every other DB wrapper in this
 * codebase isn't -- buildCaseSummaryInput() is where the actual logic
 * lives and is tested there.
 */
export async function fetchCaseSummaryInput(
  db: PrismaClient,
  claimantId: string
): Promise<CaseSummaryInput | null> {
  const claimant = await db.claimant.findUnique({
    where: { id: claimantId },
    include: {
      person: true,
      estate: true,
      documents: true,
    },
  });
  if (!claimant) return null;

  // "Competing heirs" for this estate = other PotentialHeir rows on the
  // same estate whose person isn't this claimant's own person -- doc 06's
  // own definition of a competing candidate.
  const competingHeirCount = await db.potentialHeir.count({
    where: { estateId: claimant.estateId, personId: { not: claimant.personId } },
  });

  return buildCaseSummaryInput({
    decedentName: claimant.estate.decedentName,
    claimantFirstName: claimant.person.firstName,
    claimantLastName: claimant.person.lastName,
    claimantStatus: claimant.status,
    estimatedValueCents: claimant.estate.estimatedValueCents,
    documents: claimant.documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType as RequirementCandidateDocument["documentType"],
      validationStatus: doc.validationStatus,
      duplicateStatus: doc.duplicateStatus,
    })),
    competingHeirCount,
  });
}
