import { describe, it, expect } from "vitest";
import { planClaimantResponseAction } from "./postFilingClaimantResponse";

describe("claimant response routing", () => {
  it("routes a document-uploaded claim to independent portal verification, never straight to satisfied", () => {
    expect(planClaimantResponseAction("CLAIMS_DOCUMENT_UPLOADED")).toBe("CHECK_PORTAL");
  });

  it("routes a cannot-provide-document response to an operator decision", () => {
    expect(planClaimantResponseAction("CANNOT_PROVIDE_DOCUMENT")).toBe("CREATE_OPERATOR_DECISION");
  });

  it("routes a request for explanation to the human response workflow", () => {
    expect(planClaimantResponseAction("REQUESTS_EXPLANATION")).toBe("ROUTE_TO_HUMAN_RESPONSE_WORKFLOW");
  });

  it("fails closed to a generic operator decision for an unclassifiable response, never dropping it", () => {
    expect(planClaimantResponseAction("OTHER")).toBe("CREATE_GENERIC_OPERATOR_DECISION");
  });
});
