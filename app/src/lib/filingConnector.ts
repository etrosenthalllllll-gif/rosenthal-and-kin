// Filing connector architecture + registry -- doc 08 sections 8-11.
// PLAN.md P7-4.
//
// "Create a provider abstraction: FilingConnector. Not every provider
// needs every operation -- the connector must explicitly report
// unsupported operations. Build connectors for jurisdictions/providers
// as separate modules; do not create one giant filing function with
// hundreds of jurisdiction-specific branches. Create a connector
// registry: jurisdiction + claim type + filing authority + filing
// method -> best configured connector. Connectors must be versioned;
// every filing must record which connector/version was used."
//
// Same provider-abstraction discipline as CommunicationProvider (P0-9):
// the rest of the app depends only on this interface, never a concrete
// vendor class. `InMemoryFilingConnector` below is a reference
// implementation for tests only -- real per-jurisdiction connectors are
// a separate, later concern needing actual provider integration
// (blocked on P7-5's credentials).

export type FilingConnectorOperation =
  | "validate"
  | "get_requirements"
  | "calculate_fee"
  | "create_submission"
  | "upload_document"
  | "submit"
  | "get_status"
  | "get_confirmation"
  | "cancel"
  | "retrieve_receipt"
  | "parse_rejection"
  | "get_rejection_details";

export interface FilingConnectorRequirements {
  requiredDocumentTypes: readonly string[];
  requiredMetadata: readonly string[];
  maxFileSizeBytes?: number;
  allowedFileTypes?: readonly string[];
}

export interface FilingConnectorValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FilingConnectorFeeResult {
  amountCents: number;
  currency: string;
  breakdown: string;
}

export interface FilingConnectorSubmitResult {
  externalFilingId: string;
  confirmationNumber?: string;
  rawResponse: unknown;
}

export interface FilingConnectorStatusResult {
  normalizedStatus: string;
  rawStatus: unknown;
}

export interface FilingConnectorRejectionDetails {
  reasonCode: string;
  reasonMessage: string;
  rawResponse: unknown;
}

// doc 08 section 8's own method list, verbatim. Only `submit` and
// `get_status` are required -- everything else is optional per-method,
// and `supportedOperations` is the single source of truth for which
// optional methods a given connector actually implements (checked by
// `connectorSupportsOperation`, never inferred from whether the method
// happens to be present).
export interface FilingConnector {
  connectorId: string;
  connectorVersion: string;
  provider: string;
  jurisdictions: readonly string[];
  supportedOperations: readonly FilingConnectorOperation[];
  validate?(data: unknown): Promise<FilingConnectorValidationResult>;
  getRequirements?(): Promise<FilingConnectorRequirements>;
  calculateFee?(input: unknown): Promise<FilingConnectorFeeResult>;
  createSubmission?(data: unknown): Promise<{ submissionId: string }>;
  uploadDocument?(submissionId: string, document: unknown): Promise<{ uploadId: string }>;
  submit(submissionId: string): Promise<FilingConnectorSubmitResult>;
  getStatus(externalFilingId: string): Promise<FilingConnectorStatusResult>;
  getConfirmation?(externalFilingId: string): Promise<string | null>;
  cancel?(externalFilingId: string): Promise<void>;
  retrieveReceipt?(externalFilingId: string): Promise<unknown>;
  parseRejection?(rawResponse: unknown): Promise<FilingConnectorRejectionDetails>;
  getRejectionDetails?(externalFilingId: string): Promise<FilingConnectorRejectionDetails>;
}

/**
 * doc 08 section 8: "The connector must explicitly report unsupported
 * operations." Never infer support from whether the method is merely
 * present on the object -- `supportedOperations` is authoritative.
 */
export function connectorSupportsOperation(connector: FilingConnector, operation: FilingConnectorOperation): boolean {
  return connector.supportedOperations.includes(operation);
}

// --- Connector registry (doc 08 sections 9-11) -----------------------

export interface ConnectorRegistryEntry {
  jurisdiction: string;
  claimType?: string;
  filingAuthority?: string;
  filingMethod?: string;
  connector: FilingConnector;
}

export type ConnectorResolutionOutcome = "RESOLVED" | "NOT_FOUND" | "AMBIGUOUS";

export interface ConnectorResolution {
  outcome: ConnectorResolutionOutcome;
  connector: FilingConnector | null;
  // Populated only on AMBIGUOUS, so a caller/operator sees every
  // plausible candidate rather than a silent pick.
  candidates: ConnectorRegistryEntry[];
}

export interface ConnectorResolutionCriteria {
  jurisdiction: string;
  claimType?: string;
  filingAuthority?: string;
  filingMethod?: string;
}

/**
 * Pure: doc 08 sections 9-10. Resolves jurisdiction + claim type +
 * filing authority + filing method to the single best-matching
 * registry entry's connector -- an entry with no claimType/authority/
 * method specified applies to any value of that dimension. More than
 * one entry matching equally specifically is AMBIGUOUS, never
 * auto-picked, same never-guess discipline as formCatalog.ts's
 * selectFormsForClaim() (P6-7).
 */
export function resolveConnector(
  criteria: ConnectorResolutionCriteria,
  registry: readonly ConnectorRegistryEntry[]
): ConnectorResolution {
  const matches = registry.filter(
    (entry) =>
      entry.jurisdiction === criteria.jurisdiction &&
      (entry.claimType == null || entry.claimType === criteria.claimType) &&
      (entry.filingAuthority == null || entry.filingAuthority === criteria.filingAuthority) &&
      (entry.filingMethod == null || entry.filingMethod === criteria.filingMethod)
  );

  if (matches.length === 0) {
    return { outcome: "NOT_FOUND", connector: null, candidates: [] };
  }

  if (matches.length > 1) {
    return { outcome: "AMBIGUOUS", connector: null, candidates: matches };
  }

  return { outcome: "RESOLVED", connector: matches[0].connector, candidates: [] };
}

// --- In-memory reference connector (tests only) -----------------------

/**
 * A minimal reference connector implementing only the two required
 * operations -- used to exercise the registry/decision logic in tests
 * without a real vendor account, same pattern as
 * inMemoryEmailProvider.ts (P0-9).
 */
export function createInMemoryFilingConnector(
  connectorId: string,
  jurisdictions: readonly string[]
): FilingConnector {
  const submitted = new Map<string, FilingConnectorStatusResult>();
  let counter = 0;

  return {
    connectorId,
    connectorVersion: "1.0.0",
    provider: "in-memory-reference",
    jurisdictions,
    supportedOperations: ["submit", "get_status"],
    async submit(submissionId: string) {
      counter += 1;
      const externalFilingId = `${connectorId}-${submissionId}-${counter}`;
      submitted.set(externalFilingId, { normalizedStatus: "SUBMITTED", rawStatus: "submitted" });
      return { externalFilingId, rawResponse: { submissionId } };
    },
    async getStatus(externalFilingId: string) {
      return submitted.get(externalFilingId) ?? { normalizedStatus: "UNKNOWN", rawStatus: null };
    },
  };
}
