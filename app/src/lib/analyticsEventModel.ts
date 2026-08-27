// Analytics event model + central data model -- doc 13 sections 1-3.
// PLAN.md P12-1.
//
// "Create standardized analytics events... Each event should contain
// enough information to attribute it to: case, lead, workflow, source,
// campaign, operator, date/time, jurisdiction where applicable,
// outcome, relevant cost." / "Create analytics entities for: Lead,
// Case, Claim, Communication, Workflow, Recovery, Payment, Operator,
// Cost, Revenue, Source, Campaign, Jurisdiction, Event, Metric. Do not
// duplicate the transactional database unnecessarily. Use a clean
// analytical model or reporting layer."

// doc 13 §2's own worked event-type list -- non-exhaustive/extensible,
// same discipline as eventBus.ts's EXAMPLE_EVENT_TYPES (P10-3).
export const EXAMPLE_ANALYTICS_EVENT_TYPES: readonly string[] = [
  "LEAD_CREATED",
  "LEAD_SCORED",
  "LEAD_QUALIFIED",
  "OUTREACH_CREATED",
  "OUTREACH_SENT",
  "EMAIL_DELIVERED",
  "EMAIL_OPENED",
  "EMAIL_REPLIED",
  "SMS_SENT",
  "SMS_REPLIED",
  "CALL_COMPLETED",
  "CLAIMANT_IDENTIFIED",
  "RELATIONSHIP_VERIFIED",
  "CASE_CREATED",
  "CASE_APPROVED",
  "CASE_REJECTED",
  "DOCUMENT_RECEIVED",
  "DOCUMENT_VALIDATED",
  "CLAIM_PREPARED",
  "CLAIM_REVIEWED",
  "CLAIM_FILED",
  "CLAIM_REJECTED",
  "CLAIM_RESUBMITTED",
  "CLAIM_APPROVED",
  "RECOVERY_EXPECTED",
  "RECOVERY_RECEIVED",
  "PAYMENT_RECONCILED",
  "CASE_CLOSED",
  "OPERATOR_ACTION",
  "WORKFLOW_STARTED",
  "WORKFLOW_COMPLETED",
  "WORKFLOW_FAILED",
];

export interface AnalyticsEventAttribution {
  caseId?: string;
  leadId?: string;
  workflowId?: string;
  source?: string;
  campaign?: string;
  operator?: string;
  jurisdiction?: string;
  outcome?: string;
  costCents?: number;
}

export interface AnalyticsEvent extends AnalyticsEventAttribution {
  eventType: string;
  timestamp: string;
}

/**
 * Pure: builds one attributed analytics event. Attribution fields are
 * all optional (doc 13 §2's own list is "where applicable"), but the
 * event always carries a type and timestamp -- an analytics event with
 * neither is meaningless and this shape makes that impossible to
 * construct.
 */
export function buildAnalyticsEvent(eventType: string, timestamp: string, attribution: AnalyticsEventAttribution = {}): AnalyticsEvent {
  return { eventType, timestamp, ...attribution };
}

// --- Central analytics data model (doc 13 §3) -------------------------------

// Thin reporting-layer shapes, not new storage -- each mirrors an
// existing transactional entity (Claimant/Estate/Decision/etc.) rather
// than duplicating it. "Do not duplicate the transactional database
// unnecessarily" taken literally: these are the *read* shapes an
// analytics query assembles from existing tables, never a second
// source of truth.
export interface AnalyticsLeadRecord {
  leadId: string;
  source?: string;
  campaign?: string;
  qualifiedAt?: string;
}

export interface AnalyticsCaseRecord {
  caseId: string;
  jurisdiction?: string;
  createdAt: string;
  closedAt?: string;
}

export interface AnalyticsClaimRecord {
  claimId: string;
  caseId: string;
  filedAt?: string;
  approvedAt?: string;
}

export interface AnalyticsRecoveryRecord {
  recoveryId: string;
  caseId: string;
  expectedAmountCents?: number;
  actualAmountCents?: number;
  recoveredAt?: string;
}

export interface AnalyticsCostRecord {
  category: string;
  amountCents: number;
  caseId?: string;
  workflowId?: string;
}

export interface AnalyticsRevenueRecord {
  amountCents: number;
  caseId?: string;
  recognizedAt: string;
}
