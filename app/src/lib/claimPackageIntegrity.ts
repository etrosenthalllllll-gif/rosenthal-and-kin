// Package integrity checker -- doc 07 section 41. PLAN.md P6-15.
//
// "Before a package can be marked READY_FOR_FILING, verify: every
// document/exhibit the manifest references actually exists, there are
// no duplicates, form versions are correct (not superseded), required
// signatures are present, and the manifest matches the package's
// actual contents. Any mismatch blocks READY_FOR_FILING."
//
// This checks the package claimPackage.ts (P6-14) already assembled --
// it doesn't re-derive eligibility or requirements (that's
// exhibitAssembly.ts/P6-11 and claimRequirementChecklist.ts/P6-6's
// job); it verifies the assembled package is internally consistent
// with what it claims to contain.

import type { ClaimPackage } from "./claimPackage";

export type IntegrityIssueType =
  | "MISSING_DOCUMENT"
  | "DUPLICATE_DOCUMENT_ID"
  | "MANIFEST_MISMATCH"
  | "SUPERSEDED_FORM_VERSION"
  | "MISSING_REQUIRED_SIGNATURE";

export interface IntegrityIssue {
  type: IntegrityIssueType;
  documentId: string;
  detail: string;
}

export interface PackageIntegrityInput {
  package: ClaimPackage;
  // Every document id actually available in storage right now -- a
  // manifest entry pointing at an id not in this set means the
  // referenced document doesn't actually exist.
  availableDocumentIds: readonly string[];
  // Form document ids whose form-catalog entry has since been
  // superseded (P6-7's `supersedes` chain) -- a package referencing one
  // of these is stale.
  supersededFormDocumentIds?: readonly string[];
  // Signature keys the claim type requires (P6-4's requiredSignatures)
  // and which of them the package's documents actually satisfy.
  requiredSignatureKeys?: readonly string[];
  satisfiedSignatureKeys?: readonly string[];
}

export interface PackageIntegrityResult {
  passed: boolean;
  issues: IntegrityIssue[];
}

/**
 * Pure: doc 07 section 41. Any issue found blocks READY_FOR_FILING --
 * `passed` is true only when every check clears. Never partially
 * passes; a caller reads `issues` to know exactly what to fix, same
 * "explain, don't just fail" discipline as claimCompletenessEngine.ts
 * (P6-13).
 */
export function checkPackageIntegrity(input: PackageIntegrityInput): PackageIntegrityResult {
  const issues: IntegrityIssue[] = [];
  const availableIds = new Set(input.availableDocumentIds);
  const supersededIds = new Set(input.supersededFormDocumentIds ?? []);

  const seenIds = new Set<string>();
  for (const manifestEntry of input.package.manifest) {
    if (seenIds.has(manifestEntry.documentId)) {
      issues.push({
        type: "DUPLICATE_DOCUMENT_ID",
        documentId: manifestEntry.documentId,
        detail: `Document id ${manifestEntry.documentId} appears more than once in the manifest.`,
      });
    }
    seenIds.add(manifestEntry.documentId);

    if (!availableIds.has(manifestEntry.documentId)) {
      issues.push({
        type: "MISSING_DOCUMENT",
        documentId: manifestEntry.documentId,
        detail: `Manifest references ${manifestEntry.documentId}, but no such document currently exists.`,
      });
    }

    if (supersededIds.has(manifestEntry.documentId)) {
      issues.push({
        type: "SUPERSEDED_FORM_VERSION",
        documentId: manifestEntry.documentId,
        detail: `Document ${manifestEntry.documentId} is a superseded form version and must be regenerated against the current form.`,
      });
    }
  }

  // Manifest must exactly match the package's own document list --
  // covers a manifest built from a stale/edited document set.
  const manifestIds = new Set(input.package.manifest.map((m) => m.documentId));
  const documentIds = new Set(input.package.documents.map((d) => d.documentId));
  if (manifestIds.size !== documentIds.size || [...manifestIds].some((id) => !documentIds.has(id))) {
    issues.push({
      type: "MANIFEST_MISMATCH",
      documentId: "",
      detail: "The manifest does not match the package's actual document list.",
    });
  }

  const requiredSignatureKeys = input.requiredSignatureKeys ?? [];
  const satisfiedSignatureKeys = new Set(input.satisfiedSignatureKeys ?? []);
  for (const key of requiredSignatureKeys) {
    if (!satisfiedSignatureKeys.has(key)) {
      issues.push({
        type: "MISSING_REQUIRED_SIGNATURE",
        documentId: "",
        detail: `Required signature "${key}" is not present in this package.`,
      });
    }
  }

  return { passed: issues.length === 0, issues };
}
