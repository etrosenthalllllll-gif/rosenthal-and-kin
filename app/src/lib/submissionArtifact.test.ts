import { describe, it, expect } from "vitest";
import {
  buildSubmissionArtifacts,
  markArtifactUploaded,
  markArtifactFailed,
  allArtifactsUploaded,
  type SubmissionArtifactContext,
} from "./submissionArtifact";
import { assembleClaimPackage } from "./claimPackage";

const CONTEXT: SubmissionArtifactContext = {
  filingId: "filing-1",
  filingAttemptId: "attempt-1",
  packageId: "prep-1",
  packageVersion: 4,
};

describe("submission artifact model", () => {
  it("builds one PENDING artifact per package document, preserving package order", () => {
    const pkg = assembleClaimPackage("prep-1", 4, "t1", [
      { documentId: "doc-2", role: "EXHIBIT", contentHash: "h2" },
      { documentId: "doc-1", role: "FORM", contentHash: "h1" },
    ]);
    const artifacts = buildSubmissionArtifacts(pkg.documents, CONTEXT, (doc) => ({
      id: `artifact-${doc.documentId}`,
      fileHash: doc.contentHash,
      fileFormat: "PDF",
    }));
    expect(artifacts.map((a) => a.sourceDocumentId)).toEqual(pkg.documents.map((d) => d.documentId));
    expect(artifacts.every((a) => a.submissionStatus === "PENDING")).toBe(true);
  });

  it("associates every artifact with filing/attempt/package identifiers", () => {
    const pkg = assembleClaimPackage("prep-1", 4, "t1", [{ documentId: "doc-1", role: "FORM", contentHash: "h1" }]);
    const artifacts = buildSubmissionArtifacts(pkg.documents, CONTEXT, (doc) => ({
      id: `artifact-${doc.documentId}`,
      fileHash: doc.contentHash,
      fileFormat: "PDF",
    }));
    expect(artifacts[0].filingId).toBe("filing-1");
    expect(artifacts[0].filingAttemptId).toBe("attempt-1");
    expect(artifacts[0].packageId).toBe("prep-1");
    expect(artifacts[0].packageVersion).toBe(4);
  });

  it("marking an artifact uploaded returns a new object rather than mutating it", () => {
    const pkg = assembleClaimPackage("prep-1", 4, "t1", [{ documentId: "doc-1", role: "FORM", contentHash: "h1" }]);
    const [original] = buildSubmissionArtifacts(pkg.documents, CONTEXT, (doc) => ({
      id: `artifact-${doc.documentId}`,
      fileHash: doc.contentHash,
      fileFormat: "PDF",
    }));
    const uploaded = markArtifactUploaded(original, "provider-upload-123");
    expect(original.submissionStatus).toBe("PENDING");
    expect(uploaded.submissionStatus).toBe("UPLOADED");
    expect(uploaded.providerUploadId).toBe("provider-upload-123");
  });

  it("marking an artifact failed sets FAILED without an upload id", () => {
    const pkg = assembleClaimPackage("prep-1", 4, "t1", [{ documentId: "doc-1", role: "FORM", contentHash: "h1" }]);
    const [original] = buildSubmissionArtifacts(pkg.documents, CONTEXT, (doc) => ({
      id: `artifact-${doc.documentId}`,
      fileHash: doc.contentHash,
      fileFormat: "PDF",
    }));
    const failed = markArtifactFailed(original);
    expect(failed.submissionStatus).toBe("FAILED");
    expect(failed.providerUploadId).toBeNull();
  });

  it("allArtifactsUploaded is false until every artifact is UPLOADED", () => {
    const pkg = assembleClaimPackage("prep-1", 4, "t1", [
      { documentId: "doc-1", role: "FORM", contentHash: "h1" },
      { documentId: "doc-2", role: "EXHIBIT", contentHash: "h2" },
    ]);
    const artifacts = buildSubmissionArtifacts(pkg.documents, CONTEXT, (doc) => ({
      id: `artifact-${doc.documentId}`,
      fileHash: doc.contentHash,
      fileFormat: "PDF",
    }));
    expect(allArtifactsUploaded(artifacts)).toBe(false);

    const allUploaded = artifacts.map((a) => markArtifactUploaded(a, `upload-${a.sourceDocumentId}`));
    expect(allArtifactsUploaded(allUploaded)).toBe(true);
  });

  it("allArtifactsUploaded is false for an empty artifact list -- nothing was transmitted", () => {
    expect(allArtifactsUploaded([])).toBe(false);
  });
});
