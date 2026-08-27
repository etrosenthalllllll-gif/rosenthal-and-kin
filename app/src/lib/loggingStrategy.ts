// Logging strategy: structured logs + correlation IDs + error codes --
// doc 12 sections 81-84. PLAN.md P11-27.
//
// "Implement structured logs. Each log should contain, where
// applicable: timestamp, service, environment, severity, case ID,
// workflow ID, execution ID, request ID, correlation ID, event ID,
// error code, message. Never rely solely on unstructured text logs." /
// "Use consistent IDs across API calls, workflow executions, events,
// jobs, provider requests, alerts, incidents." / "Create standardized
// internal error codes... These should map to human-readable
// explanations."
//
// Correlation-ID propagation reuses dataConsistency.ts's (P10-20)
// attachCorrelationId() rather than a second ID-stamping mechanism --
// re-exported here so a caller reading this phase's logging module
// doesn't need to know it lives in Phase 10's file.

export { attachCorrelationId } from "./dataConsistency";

export interface StructuredLogEntry {
  timestamp: string;
  service: string;
  environment: string;
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  message: string;
  caseId?: string;
  workflowId?: string;
  executionId?: string;
  requestId?: string;
  correlationId?: string;
  eventId?: string;
  errorCode?: string;
}

/**
 * Pure: builds one structured log entry with the doc's own field
 * list. Never returns a bare string -- "never rely solely on
 * unstructured text logs" is enforced by this being the only
 * log-shape this module exposes.
 */
export function buildStructuredLogEntry(entry: StructuredLogEntry): StructuredLogEntry {
  return { ...entry };
}

// --- Standardized error codes (doc 12 §84) ----------------------------------

// doc 12 §84's own worked examples, verbatim -- a config table, not a
// switch statement scattered through every module that might throw.
export const ERROR_CODE_CATALOG: Readonly<Record<string, string>> = {
  AI_001: "AI request timed out",
  EMAIL_001: "Email provider failure",
  FILING_001: "Filing submission timed out",
  QUEUE_001: "Queue processing stalled",
  SYNC_001: "Cross-system synchronization conflict",
};

/**
 * Pure: maps an internal error code to its human-readable explanation.
 * An unrecognized code returns undefined rather than a guessed
 * message -- the caller decides how to present an unmapped code
 * (typically surfacing the raw code itself).
 */
export function explainErrorCode(code: string): string | undefined {
  return ERROR_CODE_CATALOG[code];
}
