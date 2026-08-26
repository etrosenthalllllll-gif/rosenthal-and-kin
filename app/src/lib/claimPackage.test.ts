import { describe, it, expect } from "vitest";
import { assembleClaimPackage, diffClaimPackages, type ClaimPackageDocument } from "./claimPackage";

const DOCS: ClaimPackageDocument[] = [
  { documentId: "doc-2", role: "EXHIBIT", contentHash: "hash-2" },
  { documentId: "doc-1", role: "FORM", contentHash: "hash-1" },
];

describe("claim package assembly", () => {
  it("assembles a package with a manifest matching its documents", () => {
    const pkg = assembleClaimPackage("prep-1", 1, "2026-08-26T00:00:00.000Z", DOCS);
    expect(pkg.manifest).toHaveLength(2);
    expect(pkg.manifest.map((m) => m.documentId)).toEqual(pkg.documents.map((d) => d.documentId));
  });

  it("orders documents deterministically by role then documentId", () => {
    const first = assembleClaimPackage("prep-1", 1, "2026-08-26T00:00:00.000Z", DOCS);
    const second = assembleClaimPackage("prep-1", 1, "2026-08-26T00:00:00.000Z", [...DOCS].reverse());
    expect(second).toEqual(first);
  });

  it("each new version is a distinct object, not a mutation of the prior one", () => {
    const v1 = assembleClaimPackage("prep-1", 1, "2026-08-26T00:00:00.000Z", DOCS);
    const v2 = assembleClaimPackage("prep-1", 2, "2026-08-27T00:00:00.000Z", DOCS);
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(v1).not.toBe(v2);
  });
});

describe("claim package diff", () => {
  it("detects an added document", () => {
    const v1 = assembleClaimPackage("prep-1", 1, "t1", DOCS);
    const v2 = assembleClaimPackage("prep-1", 2, "t2", [...DOCS, { documentId: "doc-3", role: "DECLARATION", contentHash: "hash-3" }]);
    const diff = diffClaimPackages(v1, v2);
    expect(diff.added.map((d) => d.documentId)).toEqual(["doc-3"]);
  });

  it("detects a removed document", () => {
    const v1 = assembleClaimPackage("prep-1", 1, "t1", DOCS);
    const v2 = assembleClaimPackage("prep-1", 2, "t2", [DOCS[1]]);
    const diff = diffClaimPackages(v1, v2);
    expect(diff.removed.map((d) => d.documentId)).toEqual(["doc-2"]);
  });

  it("treats a same-id document with a different content hash as changed, not remove+add", () => {
    const v1 = assembleClaimPackage("prep-1", 1, "t1", DOCS);
    const revised = DOCS.map((d) => (d.documentId === "doc-1" ? { ...d, contentHash: "hash-1-revised" } : d));
    const v2 = assembleClaimPackage("prep-1", 2, "t2", revised);
    const diff = diffClaimPackages(v1, v2);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].documentId).toBe("doc-1");
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("lists an unchanged document as unchanged", () => {
    const v1 = assembleClaimPackage("prep-1", 1, "t1", DOCS);
    const v2 = assembleClaimPackage("prep-1", 2, "t2", DOCS);
    const diff = diffClaimPackages(v1, v2);
    expect(diff.unchanged).toHaveLength(2);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });
});
