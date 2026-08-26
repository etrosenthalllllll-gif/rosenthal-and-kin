// Rule conflict detection -- doc 07 section 7. PLAN.md P6-5.
//
// "If two applicable rules disagree, do not silently pick one. Route
// to human review, showing both rules, their sources, and their
// effective dates."
//
// A conflict here isn't two rules whose requirement lists merely add
// up (a general rule plus a claimant-type-specific rule both applying
// is normal, additive design -- see evaluateClaimRequirements). It's
// two *current* (non-superseded) rules claiming the exact same scope
// -- same jurisdiction, same claim type, same claimant type -- with
// neither one marked as superseding the other. That's a genuine
// ambiguity about which rule is actually in force, and this module
// never resolves it by picking the newer effectiveDate or the lower
// id automatically; same never-auto-resolve discipline as
// conflictDetection.ts (P5-6).

import { latestVersionsOnly, type ClaimRule, type ClaimantType } from "./claimRules";
import type { ClaimTypeKey } from "./claimTypes";

export interface RuleConflict {
  jurisdiction: string;
  claimType: ClaimTypeKey;
  claimantType?: ClaimantType;
  // Every rule sharing the disputed scope, each carrying its own
  // citation/sourceUrl/effectiveDate so a human reviewer sees the full
  // picture rather than one opaque pick.
  rules: ClaimRule[];
  requiresHumanReview: true;
}

function scopeKey(rule: ClaimRule): string {
  return `${rule.jurisdiction}::${rule.claimType}::${rule.claimantType ?? "ANY"}`;
}

/**
 * Pure: doc 07 section 7. Groups current (non-superseded) rules by
 * exact scope and flags any scope with more than one rule as a
 * conflict requiring human review.
 */
export function detectRuleConflicts(rules: readonly ClaimRule[]): RuleConflict[] {
  const current = latestVersionsOnly(rules);
  const byScope = new Map<string, ClaimRule[]>();

  for (const rule of current) {
    const key = scopeKey(rule);
    const existing = byScope.get(key) ?? [];
    existing.push(rule);
    byScope.set(key, existing);
  }

  const conflicts: RuleConflict[] = [];
  for (const group of byScope.values()) {
    if (group.length < 2) continue;
    conflicts.push({
      jurisdiction: group[0].jurisdiction,
      claimType: group[0].claimType,
      claimantType: group[0].claimantType,
      rules: group,
      requiresHumanReview: true,
    });
  }

  return conflicts;
}

/**
 * Convenience check for a single jurisdiction/claimType/claimantType
 * combination -- whether it currently has a scope conflict at all.
 */
export function hasScopeConflict(
  jurisdiction: string,
  claimType: ClaimTypeKey,
  claimantType: ClaimantType | undefined,
  rules: readonly ClaimRule[]
): boolean {
  return detectRuleConflicts(rules).some(
    (c) => c.jurisdiction === jurisdiction && c.claimType === claimType && c.claimantType === claimantType
  );
}
