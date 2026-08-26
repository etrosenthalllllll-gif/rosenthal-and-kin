// Rule/form/jurisdiction update handling -- doc 07 sections 50-53.
// PLAN.md P6-18.
//
// "A jurisdiction change invalidates the affected rules, forms,
// requirements, and exhibits, and requires a new preparation version --
// never mutate the existing one. A newer rule or form version must
// never silently replace one already used in an existing package;
// always raise a reviewable alert with an explicit
// keep-current/regenerate/review choice."
//
// This module only detects drift and describes the choice -- it
// doesn't create the new ClaimPreparation version itself (that's a
// caller wiring this into claimPreparationStateMachine.ts's/P6-16
// SUPERSEDED transition) and it doesn't re-decide which rule/form is
// current (claimRules.ts's/P6-4 `latestVersionsOnly` and
// formCatalog.ts's/P6-7 `latestFormVersionsOnly` already own that).

import { latestVersionsOnly, type ClaimRule } from "./claimRules";
import { latestFormVersionsOnly, type FormMetadata } from "./formCatalog";

export type UpdateTriggerType = "JURISDICTION_CHANGED" | "RULE_VERSION_CHANGED" | "FORM_VERSION_CHANGED";

export type UpdateChoice = "KEEP_CURRENT" | "REGENERATE" | "REVIEW";

export interface PreparationUpdateAlert {
  triggerType: UpdateTriggerType;
  affectedIds: string[];
  message: string;
  // doc 07's explicit three-way choice -- never auto-picked by this
  // module; a caller presents these to an operator.
  availableChoices: readonly UpdateChoice[];
}

const STANDARD_CHOICES: readonly UpdateChoice[] = ["KEEP_CURRENT", "REGENERATE", "REVIEW"];

/**
 * Pure: doc 07 section 50. A jurisdiction change invalidates
 * everything this preparation built under the old jurisdiction --
 * unlike a rule/form version bump, there's no "keep current" option
 * that makes sense here (the whole ruleset it was built against no
 * longer applies), so this always signals the full-invalidation case.
 */
export function detectJurisdictionChange(
  previousJurisdiction: string,
  currentJurisdiction: string
): PreparationUpdateAlert | null {
  if (previousJurisdiction === currentJurisdiction) return null;

  return {
    triggerType: "JURISDICTION_CHANGED",
    affectedIds: [previousJurisdiction, currentJurisdiction],
    message: `Jurisdiction changed from ${previousJurisdiction} to ${currentJurisdiction}. Every rule, form, requirement, and exhibit built under ${previousJurisdiction} is invalidated -- a new claim preparation version is required rather than patching this one.`,
    availableChoices: ["REGENERATE", "REVIEW"], // no KEEP_CURRENT -- the old jurisdiction's rules genuinely no longer apply
  };
}

/**
 * Pure: doc 07 section 51. Flags any rule id a package already used
 * that is no longer among the current (non-superseded) rules -- a
 * newer rule version exists, but this module never silently swaps it
 * in.
 */
export function detectRuleVersionDrift(
  usedRuleIds: readonly string[],
  currentRules: readonly ClaimRule[]
): PreparationUpdateAlert | null {
  const currentIds = new Set(latestVersionsOnly(currentRules).map((r) => r.id));
  const stale = usedRuleIds.filter((id) => !currentIds.has(id));
  if (stale.length === 0) return null;

  return {
    triggerType: "RULE_VERSION_CHANGED",
    affectedIds: stale,
    message: `This package was built using rule(s) that have since been superseded: ${stale.join(", ")}. A newer version exists but was not silently applied.`,
    availableChoices: STANDARD_CHOICES,
  };
}

/**
 * Pure: doc 07 section 52. Same as detectRuleVersionDrift, over the
 * form catalog instead of the rules table.
 */
export function detectFormVersionDrift(
  usedFormCatalogIds: readonly string[],
  currentCatalog: readonly FormMetadata[]
): PreparationUpdateAlert | null {
  const currentIds = new Set(latestFormVersionsOnly(currentCatalog).map((f) => f.id));
  const stale = usedFormCatalogIds.filter((id) => !currentIds.has(id));
  if (stale.length === 0) return null;

  return {
    triggerType: "FORM_VERSION_CHANGED",
    affectedIds: stale,
    message: `This package used form catalog entr${stale.length === 1 ? "y" : "ies"} that ha${stale.length === 1 ? "s" : "ve"} since been superseded: ${stale.join(", ")}. A newer version exists but was not silently applied.`,
    availableChoices: STANDARD_CHOICES,
  };
}

/**
 * True only for a jurisdiction-change alert -- doc 07 section 50's
 * "requires a new preparation version" is specific to that trigger; a
 * rule/form version drift can be resolved by regenerating the affected
 * pieces within the same preparation (an operator's REGENERATE choice),
 * not by superseding the whole preparation.
 */
export function requiresNewPreparationVersion(alerts: readonly PreparationUpdateAlert[]): boolean {
  return alerts.some((a) => a.triggerType === "JURISDICTION_CHANGED");
}
