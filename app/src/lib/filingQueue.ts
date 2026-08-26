// Centralized filing queue -- doc 08 section 50. PLAN.md P7-18 (part 2
// of 4).
//
// "Create a centralized filing queue. Columns: Case, Claim,
// Jurisdiction, Package, Status, Fee, Payment, Destination, Deadline,
// Last event, Next action, Priority. Actions: [REVIEW] [APPROVE]
// [SUBMIT] [TRACK] [RESOLVE] [RESUBMIT]."
//
// Pure view-model builder, same "read-only projection over already-
// computed fields" pattern as communicationTimeline.ts (P3-1): this
// module doesn't decide status/fee/deadline itself, it just assembles
// the row a dashboard renders from what earlier modules already
// determined (filingStateMachine.ts's status, filingFeeRules.ts's fee,
// filingDeadlineAlerts.ts's alert).

import type { FilingStatus } from "./filingStateMachine";
import type { FilingDeadlineAlert } from "./filingDeadlineAlerts";

// doc 08 section 50's own "next action" per status -- a config table,
// not an inline switch buried in a UI component.
const NEXT_ACTION_BY_STATUS: Record<FilingStatus, string> = {
  NOT_READY: "Resolve readiness blockers.",
  READY_FOR_FILING: "Review and approve for filing.",
  AWAITING_APPROVAL: "Awaiting operator approval.",
  APPROVED_TO_FILE: "Prepare submission.",
  PREPARING_SUBMISSION: "Complete submission preparation.",
  AWAITING_PAYMENT: "Provide payment authorization.",
  PAYMENT_PROCESSING: "Await payment confirmation.",
  PAYMENT_COMPLETE: "Submit filing.",
  SUBMITTING: "Await submission confirmation.",
  SUBMITTED: "Await provider confirmation.",
  RECEIVED: "Await processing update.",
  PROCESSING: "Await authority decision.",
  ACCEPTED: "Close out filing.",
  PENDING: "Await further authority action.",
  REJECTED: "Review rejection and open a correction.",
  CORRECTION_REQUIRED: "Resolve the open correction.",
  RESUBMISSION_REQUIRED: "Prepare and approve resubmission.",
  RESUBMITTED: "Await provider confirmation.",
  FAILED: "Review failure with operator.",
  CANCELLED: "No action -- filing cancelled.",
  CLOSED: "No action -- filing closed.",
};

export function nextActionForFilingStatus(status: FilingStatus): string {
  return NEXT_ACTION_BY_STATUS[status];
}

export interface FilingQueueRowInput {
  filingId: string;
  caseNumber: string;
  claimantName: string;
  jurisdiction: string;
  packageVersion: number;
  status: FilingStatus;
  feeAmountCents: number | null;
  paymentStatus: string | null;
  filingDestination: string | null;
  deadlineAlert: FilingDeadlineAlert | null;
  lastEventDescription: string | null;
  priorityScore: number;
}

export interface FilingQueueRow extends FilingQueueRowInput {
  nextAction: string;
}

/**
 * Pure: doc 08 section 50. Assembles one queue row, adding only the
 * `nextAction` derived from status -- every other field is taken
 * as-is from whatever already computed it.
 */
export function buildFilingQueueRow(input: FilingQueueRowInput): FilingQueueRow {
  return { ...input, nextAction: nextActionForFilingStatus(input.status) };
}

export function buildFilingQueue(inputs: readonly FilingQueueRowInput[]): FilingQueueRow[] {
  return inputs.map(buildFilingQueueRow);
}
