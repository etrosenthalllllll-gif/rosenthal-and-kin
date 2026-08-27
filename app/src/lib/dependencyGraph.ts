// Dependency graph + blast-radius detection + system-wide alert
// grouping -- doc 12 sections 75-77. PLAN.md P11-25.
//
// "Build a dependency map. Example: CLAIM FILING depends on
// Verification, Documents, Claim preparation, Filing API, Database.
// If filing API is down: highlight downstream workflows that may be
// affected." / "When a component fails, identify: affected workflows,
// queues, cases, operators, external actions. Example: filing
// provider outage: potentially affected 142 cases." / "If a major
// dependency fails: create one primary incident... Do not create 142
// unrelated critical alerts unless necessary."

export type DependencyGraph = Readonly<Record<string, readonly string[]>>;

/**
 * Pure: doc 12 §75's own worked example. `findDependentWorkflows()` is
 * the reverse lookup the doc actually needs -- "if filing API is
 * down, highlight downstream workflows" means finding every workflow
 * whose declared dependency list includes the failed component, not
 * looking up a workflow's own dependencies.
 */
export function findDependentWorkflows(failedComponent: string, graph: DependencyGraph): string[] {
  return Object.entries(graph)
    .filter(([, dependencies]) => dependencies.includes(failedComponent))
    .map(([workflow]) => workflow);
}

// --- Blast-radius detection (doc 12 §76) ------------------------------------

export interface BlastRadius {
  affectedWorkflows: readonly string[];
  affectedCaseCount: number;
  affectedCaseIds: readonly string[];
}

/**
 * Pure: doc 12 §76's own worked example ("filing provider outage:
 * potentially affected 142 cases"). Combines the dependency graph's
 * downstream-workflow lookup with a caller-supplied
 * workflow-to-active-cases map to compute the actual blast radius.
 */
export function computeBlastRadius(
  failedComponent: string,
  graph: DependencyGraph,
  activeCasesByWorkflow: Readonly<Record<string, readonly string[]>>
): BlastRadius {
  const affectedWorkflows = findDependentWorkflows(failedComponent, graph);
  const affectedCaseIds = [...new Set(affectedWorkflows.flatMap((w) => activeCasesByWorkflow[w] ?? []))];
  return { affectedWorkflows, affectedCaseCount: affectedCaseIds.length, affectedCaseIds };
}

// --- System-wide alert grouping (doc 12 §77) --------------------------------

export interface SystemWideAlertSummary {
  rootComponent: string;
  affectedCaseCount: number;
  pausedWorkflowCount: number;
  queuedWorkflowCount: number;
}

/**
 * Pure: doc 12 §77 -- "do not create 142 unrelated critical alerts
 * unless necessary." Once a blast radius crosses the configured
 * threshold, the caller should raise exactly one system-wide incident
 * (via incidentModel.ts's buildIncidentFromAlerts(), P11-16) rather
 * than one alert per affected case.
 */
export function shouldRaiseSystemWideIncident(blastRadius: BlastRadius, threshold = 10): boolean {
  return blastRadius.affectedCaseCount >= threshold;
}

export function buildSystemWideAlertSummary(params: {
  rootComponent: string;
  blastRadius: BlastRadius;
  pausedWorkflowCount: number;
  queuedWorkflowCount: number;
}): SystemWideAlertSummary {
  return {
    rootComponent: params.rootComponent,
    affectedCaseCount: params.blastRadius.affectedCaseCount,
    pausedWorkflowCount: params.pausedWorkflowCount,
    queuedWorkflowCount: params.queuedWorkflowCount,
  };
}
