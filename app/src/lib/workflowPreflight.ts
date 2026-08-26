// Automation dependencies + pre-flight/post-flight checks -- doc 11
// sections 91-93. PLAN.md P10-23.
//
// "Each workflow should declare dependencies... if a required
// dependency is unavailable: do not start workflow. Queue or pause
// appropriately." / "Before starting important workflows: check
// required data, required documents, required permissions, provider
// availability, case state, pending conflicting workflows, approval
// requirements, budget limits. Then: READY or BLOCKED." / "After an
// action: validate that expected outcome occurred... do not mark
// success simply because the API request returned without throwing an
// exception."
//
// Same "list every blocker, never a bare boolean" readiness-check
// pattern as filingReadiness.ts/postFilingClosure.ts/
// recoveryVerification.ts/financialClosure.ts.

// --- Workflow dependencies (doc 11 §91) --------------------------------------

export interface DependencyCheckResult {
  ready: boolean;
  missingDependencies: string[];
}

/**
 * Pure: a workflow never starts with an unavailable dependency --
 * every missing one is listed, not just the first, so an operator (or
 * the queueing logic) sees the full picture at once.
 */
export function evaluateWorkflowDependencies(
  requiredDependencies: readonly string[],
  availableSystems: ReadonlySet<string>
): DependencyCheckResult {
  const missingDependencies = requiredDependencies.filter((dep) => !availableSystems.has(dep));
  return { ready: missingDependencies.length === 0, missingDependencies };
}

// --- Pre-flight check (doc 11 §92) ------------------------------------------

export interface PreFlightCheckInput {
  hasRequiredData: boolean;
  hasRequiredDocuments: boolean;
  hasRequiredPermissions: boolean;
  providerAvailable: boolean;
  caseStateValid: boolean;
  hasConflictingWorkflow: boolean;
  withinBudget: boolean;
}

export type PreFlightBlocker =
  | "MISSING_REQUIRED_DATA"
  | "MISSING_REQUIRED_DOCUMENTS"
  | "MISSING_REQUIRED_PERMISSIONS"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_CASE_STATE"
  | "CONFLICTING_WORKFLOW"
  | "BUDGET_EXCEEDED";

export interface PreFlightCheckResult {
  status: "READY" | "BLOCKED";
  blockers: PreFlightBlocker[];
}

/**
 * Pure: doc 11 §92's own checklist, config-table style -- every failed
 * check is collected into `blockers` rather than short-circuiting on
 * the first one, so an operator sees everything standing in the way
 * at once (same discipline as filingReadiness.ts's evaluateFilingReadiness()).
 */
export function evaluatePreFlightCheck(input: PreFlightCheckInput): PreFlightCheckResult {
  const blockers: PreFlightBlocker[] = [];
  if (!input.hasRequiredData) blockers.push("MISSING_REQUIRED_DATA");
  if (!input.hasRequiredDocuments) blockers.push("MISSING_REQUIRED_DOCUMENTS");
  if (!input.hasRequiredPermissions) blockers.push("MISSING_REQUIRED_PERMISSIONS");
  if (!input.providerAvailable) blockers.push("PROVIDER_UNAVAILABLE");
  if (!input.caseStateValid) blockers.push("INVALID_CASE_STATE");
  if (input.hasConflictingWorkflow) blockers.push("CONFLICTING_WORKFLOW");
  if (!input.withinBudget) blockers.push("BUDGET_EXCEEDED");
  return { status: blockers.length === 0 ? "READY" : "BLOCKED", blockers };
}

// --- Post-flight validation (doc 11 §93) ------------------------------------

export interface PostFlightValidationResult {
  status: "SUCCESS" | "FAILED_MISSING_EXPECTED_OUTCOME";
  missingKeys: string[];
}

/**
 * Pure: doc 11 §93's own example -- an email-send action's expected
 * outcome is a provider message id; if the response doesn't actually
 * contain it, this is FAILED even though the API call itself didn't
 * throw. Never trusts a non-throwing response as proof of success.
 */
export function validatePostFlightOutcome(
  expectedKeys: readonly string[],
  response: Record<string, unknown>
): PostFlightValidationResult {
  const missingKeys = expectedKeys.filter((key) => response[key] === undefined || response[key] === null);
  return { status: missingKeys.length === 0 ? "SUCCESS" : "FAILED_MISSING_EXPECTED_OUTCOME", missingKeys };
}
