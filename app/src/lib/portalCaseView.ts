// "My Case" view-model for the claimant portal -- doc 05's client
// portal mockup: a stepper, a document checklist, a case timeline, and
// a recovery summary. Reuses documentRequirements.ts's already-tested
// checklist logic rather than a second document-status calculation.

import {
  buildDocumentChecklist,
  detectMissingDocuments,
  type RequirementCandidateDocument,
  type ChecklistItem,
} from "./documentRequirements";
import type { ClaimantStatus } from "./stateMachine";

// The mockup's own 6-step stepper, each mapped to the ClaimantStatus
// values that have reached (or passed) that point. A status not listed
// for a later step is treated as "not yet reached" -- steps are always
// monotonic here, never skipped or inferred out of order.
export const PORTAL_STEPPER_STEPS = [
  "CONTACTED",
  "IDENTITY_VERIFIED",
  "DOCUMENTS",
  "CLAIM_READY",
  "FILED",
  "RECOVERY_AND_PAYMENT",
] as const;
export type PortalStepperStep = (typeof PORTAL_STEPPER_STEPS)[number];

const STATUS_TO_STEP_INDEX: Record<ClaimantStatus, number> = {
  LEAD: -1,
  CONTACTED: 0,
  RESPONDED: 0,
  POTENTIAL_HEIR: 0,
  VERIFIED: 1,
  ENGAGED: 1,
  DOCUMENTS_REQUESTED: 2,
  DOCUMENTS_COMPLETE: 2,
  CLAIM_READY: 3,
  AWAITING_OPERATOR_APPROVAL: 3,
  APPROVED: 3,
  FILED: 4,
  PENDING: 4,
  RECOVERY: 5,
  PAID: 5,
  CLOSED: 5,
  REJECTED: -1,
  WITHDRAWN: -1,
  ESCALATED: -1,
};

export interface StepperStepView {
  step: PortalStepperStep;
  status: "done" | "current" | "upcoming";
}

/**
 * Pure: maps a claimant's real lifecycle status onto the portal's
 * 6-step stepper. A status the mapping doesn't recognize as "reached
 * any step yet" (LEAD, or an exit state like REJECTED/WITHDRAWN/
 * ESCALATED) renders every step as upcoming rather than guessing --
 * the case page has its own honest way of surfacing those states.
 */
export function buildStepperView(claimantStatus: ClaimantStatus): StepperStepView[] {
  const currentIndex = STATUS_TO_STEP_INDEX[claimantStatus] ?? -1;
  return PORTAL_STEPPER_STEPS.map((step, index) => ({
    step,
    status: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
  }));
}

export interface RecoverySummaryView {
  estimatedRecoveryCents: number | null;
  // Only populated once a real Invoice exists -- a fee is never
  // estimated or guessed here, per doc 03's compliance discipline
  // (the actual fee calculation belongs to complianceRules.ts /
  // the financial pipeline, not duplicated in the portal).
  feeAmountCents: number | null;
  estimatedToClaimantCents: number | null;
}

export function buildRecoverySummary(
  estimatedRecoveryCents: number | null,
  feeAmountCents: number | null
): RecoverySummaryView {
  return {
    estimatedRecoveryCents,
    feeAmountCents,
    estimatedToClaimantCents:
      estimatedRecoveryCents != null && feeAmountCents != null
        ? estimatedRecoveryCents - feeAmountCents
        : null,
  };
}

export interface PortalCaseView {
  stepper: StepperStepView[];
  documentChecklist: ChecklistItem[];
  missingRequiredDocuments: ChecklistItem[];
  recoverySummary: RecoverySummaryView;
}

export function buildPortalCaseView(inputs: {
  claimantStatus: ClaimantStatus;
  documents: readonly RequirementCandidateDocument[];
  estimatedRecoveryCents: number | null;
  feeAmountCents: number | null;
}): PortalCaseView {
  const documentChecklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", inputs.documents);
  return {
    stepper: buildStepperView(inputs.claimantStatus),
    documentChecklist,
    missingRequiredDocuments: detectMissingDocuments(documentChecklist),
    recoverySummary: buildRecoverySummary(inputs.estimatedRecoveryCents, inputs.feeAmountCents),
  };
}
