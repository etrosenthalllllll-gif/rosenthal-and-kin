// Completeness engine -- doc 07 sections 33-37. PLAN.md P6-13.
//
// "Combine every requirement/form/signature/exhibit/verification/
// conflict signal into a single COMPLETE / INCOMPLETE /
// REQUIRES_REVIEW status. Some conditions are hard blockers that can
// never be overridden by an otherwise-good score; others are soft
// warnings. Always produce a human-readable explanation -- never just
// 'claim incomplete.'"
//
// This is a central *composer*, not a new source of truth: it doesn't
// re-derive whether a document is missing or a rule conflict exists --
// each earlier P6 module (claimRequirementChecklist.ts/P6-6,
// claimRuleConflict.ts/P6-5, formCatalog.ts/P6-7, formValidation.ts/
// P6-9, verificationSnapshot.ts/P5-11) already knows how to explain its
// own signal. Whatever wires this into real case data (a later,
// separate task) is responsible for translating those modules' outputs
// into CompletenessSignal entries; this module's only job is combining
// them with the hard-blocker/soft-warning distinction and producing one
// explanation, never a bare status code.

export interface CompletenessSignal {
  key: string;
  // A hard blocker can never be outvoted by everything else being
  // satisfied -- doc 07 section 34's own instruction. An unsatisfied
  // soft signal only ever produces REQUIRES_REVIEW, never INCOMPLETE.
  isHardBlocker: boolean;
  satisfied: boolean;
  explanation: string;
}

export type CompletenessStatus = "COMPLETE" | "INCOMPLETE" | "REQUIRES_REVIEW";

export interface CompletenessEvaluationResult {
  status: CompletenessStatus;
  hardBlockers: CompletenessSignal[];
  softWarnings: CompletenessSignal[];
  // Human-readable, never a bare status code -- doc 07 section 37.
  explanation: string;
}

/**
 * Pure: doc 07 sections 33-37. Any unsatisfied hard blocker forces
 * INCOMPLETE outright, regardless of how many other signals are
 * satisfied -- no score or count of "good" signals can override it.
 * With no hard blockers but at least one unsatisfied soft signal, the
 * claim REQUIRES_REVIEW rather than being silently treated as
 * COMPLETE. Only with every signal satisfied is it COMPLETE.
 */
export function evaluateClaimCompleteness(
  signals: readonly CompletenessSignal[]
): CompletenessEvaluationResult {
  const hardBlockers = signals.filter((s) => s.isHardBlocker && !s.satisfied);
  const softWarnings = signals.filter((s) => !s.isHardBlocker && !s.satisfied);

  let status: CompletenessStatus;
  if (hardBlockers.length > 0) {
    status = "INCOMPLETE";
  } else if (softWarnings.length > 0) {
    status = "REQUIRES_REVIEW";
  } else {
    status = "COMPLETE";
  }

  const explanation = buildExplanation(status, hardBlockers, softWarnings);

  return { status, hardBlockers, softWarnings, explanation };
}

function buildExplanation(
  status: CompletenessStatus,
  hardBlockers: readonly CompletenessSignal[],
  softWarnings: readonly CompletenessSignal[]
): string {
  if (status === "COMPLETE") {
    return "All requirements satisfied; no outstanding blockers or warnings.";
  }

  const lines: string[] = [];
  if (hardBlockers.length > 0) {
    lines.push("Blocking (must be resolved before this claim can proceed):");
    for (const b of hardBlockers) lines.push(`- ${b.explanation}`);
  }
  if (softWarnings.length > 0) {
    lines.push("Requires human review (not blocking, but not auto-clearable):");
    for (const w of softWarnings) lines.push(`- ${w.explanation}`);
  }
  return lines.join("\n");
}
