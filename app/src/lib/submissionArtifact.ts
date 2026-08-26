// Document transmission + submission artifact model -- doc 08 sections
// 18-20. PLAN.md P7-8.
//
// "Never modify the approved package merely to satisfy a provider. If a
// provider requires a different format, create a SubmissionArtifact
// linked to the approved package -- the original approved package
// remains unchanged. Every transmitted document should be associated
// with: Filing ID, Attempt ID, Package version, Document ID, external
// upload ID where available. This allows complete reconstruction of
// what was actually transmitted."
//
// Same "plan now, a caller wires the real upload/conversion later"
// split as every other pure module in this codebase: this module
// builds and tracks artifact *records* in package order -- it doesn't
// perform an actual file-format conversion or a live upload (blocked
// behind P7-5's provider credentials). Never mutates the approved
// ClaimPackage (P6-14) itself.

import type { ClaimPackageDocument } from "./claimPackage";

export type SubmissionStatus = "PENDING" | "UPLOADED" | "FAILED";

export interface SubmissionArtifact {
  id: string;
  filingId: string;
  filingAttemptId: string;
  packageId: string;
  packageVersion: number;
  sourceDocumentId: string;
  fileHash: string;
  fileFormat: string;
  providerUploadId: string | null;
  submissionStatus: SubmissionStatus;
}

export interface SubmissionArtifactContext {
  filingId: string;
  filingAttemptId: string;
  packageId: string;
  packageVersion: number;
}

export interface DerivedArtifactContent {
  id: string;
  fileHash: string;
  fileFormat: string;
}

/**
 * Pure: doc 08 sections 18-20. Builds one PENDING SubmissionArtifact
 * per package document, in the exact order `packageDocuments` is given
 * -- claimPackage.ts's (P6-14) `assembleClaimPackage()` already returns
 * documents in deterministic order, so mapping straight over that list
 * preserves package order without this module re-deriving it. The
 * approved package itself is never touched -- `deriveArtifact` is the
 * caller's hook for producing a possibly-reformatted file (e.g. PDF/A
 * -> individual PDFs) without altering the source.
 */
export function buildSubmissionArtifacts(
  packageDocuments: readonly ClaimPackageDocument[],
  context: SubmissionArtifactContext,
  deriveArtifact: (doc: ClaimPackageDocument) => DerivedArtifactContent
): SubmissionArtifact[] {
  return packageDocuments.map((doc) => {
    const derived = deriveArtifact(doc);
    return {
      id: derived.id,
      filingId: context.filingId,
      filingAttemptId: context.filingAttemptId,
      packageId: context.packageId,
      packageVersion: context.packageVersion,
      sourceDocumentId: doc.documentId,
      fileHash: derived.fileHash,
      fileFormat: derived.fileFormat,
      providerUploadId: null,
      submissionStatus: "PENDING",
    };
  });
}

/**
 * Doc 08 section 20: an artifact records its external upload ID "where
 * available" -- once a real upload succeeds. Returns a new object
 * rather than mutating the artifact in place, same immutable-record
 * discipline as every other *Snapshot/*Version builder in this
 * codebase.
 */
export function markArtifactUploaded(artifact: SubmissionArtifact, providerUploadId: string): SubmissionArtifact {
  return { ...artifact, providerUploadId, submissionStatus: "UPLOADED" };
}

export function markArtifactFailed(artifact: SubmissionArtifact): SubmissionArtifact {
  return { ...artifact, submissionStatus: "FAILED" };
}

/**
 * doc 08 section 20: "This allows complete reconstruction of what was
 * actually transmitted." True only once every artifact has a
 * confirmed, successful upload.
 */
export function allArtifactsUploaded(artifacts: readonly SubmissionArtifact[]): boolean {
  return artifacts.length > 0 && artifacts.every((a) => a.submissionStatus === "UPLOADED");
}
