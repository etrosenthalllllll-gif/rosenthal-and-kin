// Operator hours saved + automation value model -- doc 13 sections
// 41-42. PLAN.md P12-15.
//
// "Estimate hours saved by automation: (manual hours per case
// baseline − actual operator hours per case) × cases processed. Be
// clear this is a modeled estimate, not a measured fact, unless
// baseline was actually measured pre-automation." / "Automation value
// = labor cost avoided + throughput gain value + value of additional
// cases handled − cost of automation (AI + infrastructure). Show the
// components and assumptions, not just one number."

// --- Operator hours saved (doc 13 §41) --------------------------------------

export interface HoursSavedInputs {
  baselineManualHoursPerCase: number;
  actualOperatorHoursPerCase: number;
  casesProcessed: number;
  /** True only when baselineManualHoursPerCase came from real
   * pre-automation measurement, not a guess or industry estimate. */
  baselineIsMeasured: boolean;
}

export interface HoursSavedReport {
  hoursSavedPerCase: number;
  totalHoursSaved: number;
  isModeledEstimate: boolean;
}

/**
 * Pure: doc 13 §41 -- "be clear this is a modeled estimate, not a
 * measured fact, unless baseline was actually measured." The
 * `isModeledEstimate` flag is the negation of `baselineIsMeasured`,
 * carried through explicitly so callers never present a modeled
 * number as measured fact.
 */
export function computeHoursSaved(inputs: HoursSavedInputs): HoursSavedReport {
  const hoursSavedPerCase = inputs.baselineManualHoursPerCase - inputs.actualOperatorHoursPerCase;
  return {
    hoursSavedPerCase,
    totalHoursSaved: hoursSavedPerCase * inputs.casesProcessed,
    isModeledEstimate: !inputs.baselineIsMeasured,
  };
}

// --- Automation value model (doc 13 §42) ------------------------------------

export interface AutomationValueComponents {
  laborCostAvoidedCents: number;
  throughputGainValueCents: number;
  additionalCasesValueCents: number;
  automationCostCents: number;
}

export interface AutomationValueAssumption {
  label: string;
  value: string;
}

export interface AutomationValueReport extends AutomationValueComponents {
  netValueCents: number;
  assumptions: readonly AutomationValueAssumption[];
}

/**
 * Pure: doc 13 §42's own formula, "show the components and
 * assumptions, not just one number" -- every input component is
 * returned alongside the net figure, and the caller-supplied
 * assumptions list travels with the result rather than being
 * discarded after the arithmetic.
 */
export function computeAutomationValue(components: AutomationValueComponents, assumptions: readonly AutomationValueAssumption[] = []): AutomationValueReport {
  const netValueCents =
    components.laborCostAvoidedCents + components.throughputGainValueCents + components.additionalCasesValueCents - components.automationCostCents;
  return { ...components, netValueCents, assumptions };
}
