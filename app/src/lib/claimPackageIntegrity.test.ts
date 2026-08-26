import { describe, it, expect } from "vitest";
import { checkPackageIntegrity } from "./claimPackageIntegrity";
import { assembleClaimPackage } from "./claimPackage";

const DOCS = [
  { documentId: "doc-1", role: "FORM" as const, contentHash: "h1" },
  { documentId: "doc-2", role: "EXHIBIT" as const, contentHash: "h2" },
];

describe("package integrity checker", () => {
  it("passes when every check clears", () => {
    const pkg = assembleClaimPackage("prep-1", 1, "t1", DOCS);
    const result = checkPackageIntegrity({ package: pkg, availableDocumentIds: ["doc-1", "doc-2"] });
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags a manifest entry referencing a document that doesn't exist", () => {
    const pkg = assembleClaimPackage("prep-1", 1, "t1", DOCS);
    const result = checkPackageIntegrity({ package: pkg, availableDocumentIds: ["doc-1"] });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.type === "MISSING_DOCUMENT" && i.documentId === "doc-2")).toBe(true);
  });

  it("flags a superseded form version", () => {
    const pkg = assembleClaimPackage("prep-1", 1, "t1", DOCS);
    const result = checkPackageIntegrity({
      package: pkg,
      availableDocumentIds: ["doc-1", "doc-2"],
      supersededFormDocumentIds: ["doc-1"],
    });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.type === "SUPERSEDED_FORM_VERSION")).toBe(true);
  });

  it("flags a missing required signature", () => {
    const pkg = assembleClaimPackage("prep-1", 1, "t1", DOCS);
    const result = checkPackageIntegrity({
      package: pkg,
      availableDocumentIds: ["doc-1", "doc-2"],
      requiredSignatureKeys: ["CLAIMANT"],
      satisfiedSignatureKeys: [],
    });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.type === "MISSING_REQUIRED_SIGNATURE")).toBe(true);
  });

  it("does not flag a signature that is satisfied", () => {
    const pkg = assembleClaimPackage("prep-1", 1, "t1", DOCS);
    const result = checkPackageIntegrity({
      package: pkg,
      availableDocumentIds: ["doc-1", "doc-2"],
      requiredSignatureKeys: ["CLAIMANT"],
      satisfiedSignatureKeys: ["CLAIMANT"],
    });
    expect(result.passed).toBe(true);
  });

  it("flags a manifest/document mismatch when the package is inconsistent", () => {
    const pkg = assembleClaimPackage("prep-1", 1, "t1", DOCS);
    const tampered = { ...pkg, manifest: [...pkg.manifest, { documentId: "doc-3", role: "EXHIBIT" as const, contentHash: "h3" }] };
    const result = checkPackageIntegrity({ package: tampered, availableDocumentIds: ["doc-1", "doc-2", "doc-3"] });
    expect(result.issues.some((i) => i.type === "MANIFEST_MISMATCH")).toBe(true);
  });
});
