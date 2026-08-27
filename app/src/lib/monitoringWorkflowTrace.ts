// Workflow trace + system timeline -- doc 12 sections 61-62. PLAN.md
// P11-21.
//
// "Allow operator to inspect: Trigger -> Workflow -> Step -> API ->
// Result -> Retry -> Next step. Example: CLAIM_FILING Step 4: Submit
// filing. API: Provider X. Result: Timeout. Retry: Attempt 2. Result:
// Success. Provider reference: XYZ123. This should be one continuous
// trace." / "Create an event timeline for the entire system... This
// helps diagnose incidents."
//
// Extends P10-14's `buildWorkflowTrace()` (automationObservability.ts)
// and P10-20's `buildCaseTimeline()` (dataConsistency.ts) rather than
// rebuilding trace/timeline machinery a third time -- this module only
// adds the doc 12-specific per-step API/retry detail on top of them.

import { buildWorkflowTrace, type WorkflowTraceStep } from "./automationObservability";
import { buildCaseTimeline, type CaseTimelineEntry } from "./dataConsistency";

export interface WorkflowTraceStepDetail {
  step: string;
  api?: string;
  result?: string;
  retryAttempt?: number;
  providerReference?: string;
}

export interface DetailedWorkflowTraceEntry extends WorkflowTraceStep {
  detail?: WorkflowTraceStepDetail;
}

/**
 * Pure: builds the base chronological trace via
 * automationObservability.ts's buildWorkflowTrace(), then attaches the
 * doc 12 §61 per-step API/result/retry/provider-reference detail so
 * the whole thing reads as "one continuous trace" rather than two
 * separate views the operator has to mentally merge.
 */
export function buildDetailedWorkflowTrace(
  events: readonly { eventType: string; timestamp: string; detail?: WorkflowTraceStepDetail }[]
): DetailedWorkflowTraceEntry[] {
  const baseTrace = buildWorkflowTrace(events);
  const detailByLabel = new Map(events.map((e) => [e.eventType, e.detail]));
  return baseTrace.map((step) => ({ ...step, detail: detailByLabel.get(step.label) }));
}

/**
 * Pure: re-exports P10-20's buildCaseTimeline() for the doc 12 §62
 * system-wide event timeline -- same merge-and-sort-chronologically
 * behavior, just named for this phase's monitoring-center context.
 */
export function buildSystemTimeline(entries: readonly CaseTimelineEntry[]): CaseTimelineEntry[] {
  return buildCaseTimeline(entries);
}
