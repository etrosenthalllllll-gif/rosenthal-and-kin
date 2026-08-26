// Recovery entity + ExpectedRecovery + estimate versioning -- doc 10
// sections 1-4. PLAN.md P9-1.
//
// "Expected recoveries may change. Never overwrite historical
// expectations. Create a RecoveryEstimateVersion for each change. The
// system must clearly label estimates versus confirmed amounts."
//
// Governs the schema's Recovery/RecoveryEstimateVersion models (P9-1).
// Same versioned-history discipline as every other *Version model in
// this codebase (DistributionVersion/P9-4, claimRules.ts's supersedes
// chain) -- a revised estimate is always a new row, never an edit to
// an existing one.

export interface RecoveryEstimateVersionRecord {
  version: number;
  amountCents: number;
  expectedDate?: string;
  source?: string;
  reasonForChange?: string;
  operatorOrSystem: string;
  supportingDocumentId?: string;
  createdAt: string;
}

/**
 * Pure: the current estimate is always the highest version number
 * present -- never assumed to be the most recently created row (in
 * case creation order and version numbering ever diverge, version
 * number is the authoritative ordering).
 */
export function getCurrentEstimate(
  versions: readonly RecoveryEstimateVersionRecord[]
): RecoveryEstimateVersionRecord | null {
  if (versions.length === 0) return null;
  return versions.reduce((latest, v) => (v.version > latest.version ? v : latest));
}

export interface NewEstimateInput {
  amountCents: number;
  expectedDate?: string;
  source?: string;
  reasonForChange?: string;
  operatorOrSystem: string;
  supportingDocumentId?: string;
  createdAt: string;
}

/**
 * Pure: doc 10 section 4. Never overwrites a prior estimate -- always
 * returns a brand-new version numbered one past the current highest,
 * regardless of what the prior estimate said. The caller `create()`s
 * this as a new row; the prior version's row is never touched.
 */
export function createNextEstimateVersion(
  existingVersions: readonly RecoveryEstimateVersionRecord[],
  input: NewEstimateInput
): RecoveryEstimateVersionRecord {
  const current = getCurrentEstimate(existingVersions);
  return { ...input, version: (current?.version ?? 0) + 1 };
}
