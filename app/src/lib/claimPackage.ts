// Claim package generator + versioning + manifest + diff -- doc 07
// sections 38-40, 54. PLAN.md P6-14.
//
// "Deterministically assemble a claim package from forms, declarations,
// documents, and exhibits. Every version must be preserved -- never
// mutate a historical package version in place. Produce a
// machine-readable manifest. Support a package-to-package diff so an
// operator re-reviewing a regenerated package can see exactly what
// changed, not re-review everything from scratch."
//
// Same create-only discipline as verificationSnapshot.ts (P5-11): this
// module never edits a ClaimPackage after the fact -- `assembleClaimPackage`
// always returns a brand-new object, and a caller that needs a "next"
// version calls it again with an incremented version number rather than
// mutating the one already on file.

export type ClaimPackageDocumentRole = "FORM" | "DECLARATION" | "SUPPORTING_DOCUMENT" | "EXHIBIT" | "COVER_LETTER";

export interface ClaimPackageDocument {
  documentId: string;
  role: ClaimPackageDocumentRole;
  // A content fingerprint (e.g. a hash of the generated/uploaded
  // bytes) -- diffing compares this, not just presence/absence, so a
  // silently-changed document is caught even when its id is unchanged.
  contentHash: string;
}

export interface ClaimPackageManifestEntry {
  documentId: string;
  role: ClaimPackageDocumentRole;
  contentHash: string;
}

export interface ClaimPackage {
  claimPreparationId: string;
  version: number;
  createdAt: string; // ISO -- caller-supplied, not generated here
  documents: ClaimPackageDocument[];
  manifest: ClaimPackageManifestEntry[];
}

function sortedDocuments(documents: readonly ClaimPackageDocument[]): ClaimPackageDocument[] {
  // Deterministic ordering so two assemblies of the identical document
  // set always produce byte-identical manifests -- the same
  // regeneration-stability discipline as exhibitAssembly.ts (P6-11).
  return [...documents].sort((a, b) => {
    const roleCompare = a.role.localeCompare(b.role);
    return roleCompare !== 0 ? roleCompare : a.documentId.localeCompare(b.documentId);
  });
}

/**
 * Pure: doc 07 sections 38-40. Assembles a claim package (with its
 * machine-readable manifest) from the given documents at a specific
 * version. Always returns a new object -- callers must never mutate a
 * previously-returned ClaimPackage; a new version is a new call with an
 * incremented `version`.
 */
export function assembleClaimPackage(
  claimPreparationId: string,
  version: number,
  createdAt: string,
  documents: readonly ClaimPackageDocument[]
): ClaimPackage {
  const ordered = sortedDocuments(documents);
  return {
    claimPreparationId,
    version,
    createdAt,
    documents: ordered,
    manifest: ordered.map((d) => ({ documentId: d.documentId, role: d.role, contentHash: d.contentHash })),
  };
}

export interface ClaimPackageDiff {
  added: ClaimPackageDocument[];
  removed: ClaimPackageDocument[];
  changed: { documentId: string; role: ClaimPackageDocumentRole; oldContentHash: string; newContentHash: string }[];
  unchanged: ClaimPackageDocument[];
}

/**
 * Pure: doc 07 section 54. Compares two package versions by document
 * id -- an id present in both but with a different contentHash is
 * `changed`, not treated as remove+add, so an operator re-reviewing a
 * regenerated package sees exactly what's new to look at rather than
 * the whole package again.
 */
export function diffClaimPackages(previous: ClaimPackage, next: ClaimPackage): ClaimPackageDiff {
  const previousById = new Map(previous.documents.map((d) => [d.documentId, d]));
  const nextById = new Map(next.documents.map((d) => [d.documentId, d]));

  const added: ClaimPackageDocument[] = [];
  const changed: ClaimPackageDiff["changed"] = [];
  const unchanged: ClaimPackageDocument[] = [];

  for (const doc of next.documents) {
    const prior = previousById.get(doc.documentId);
    if (!prior) {
      added.push(doc);
    } else if (prior.contentHash !== doc.contentHash) {
      changed.push({ documentId: doc.documentId, role: doc.role, oldContentHash: prior.contentHash, newContentHash: doc.contentHash });
    } else {
      unchanged.push(doc);
    }
  }

  const removed = previous.documents.filter((d) => !nextById.has(d.documentId));

  return { added, removed, changed, unchanged };
}
