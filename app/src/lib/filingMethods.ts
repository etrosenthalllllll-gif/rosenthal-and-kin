// Filing method config table -- doc 08 section 7. PLAN.md P7-3.
//
// "Create configurable FilingMethod records ... Each method should
// define: Submission mechanism, Required metadata, Required documents,
// Authentication, Fee process, Confirmation mechanism, Status
// mechanism, Retry behavior, Manual steps, Supported operations."
//
// Config-table pattern, same discipline as claimTypes.ts (P6-2):
// the requirements live in one versioned table, not scattered through
// UI components or a filing connector's own code.

export type FilingMethodKey =
  | "ONLINE_PORTAL"
  | "API"
  | "ELECTRONIC_PROVIDER"
  | "EMAIL_SUBMISSION"
  | "SECURE_UPLOAD"
  | "PHYSICAL_MAIL"
  | "OTHER";

export type FeeProcess = "NONE" | "PAID_BEFORE_SUBMISSION" | "PAID_AFTER_SUBMISSION" | "PAID_AFTER_ACCEPTANCE";

export interface FilingMethodConfig {
  key: FilingMethodKey;
  displayName: string;
  description: string;
  submissionMechanism: string;
  requiredMetadata: readonly string[];
  requiredDocumentFormats: readonly string[];
  authenticationRequired: boolean;
  feeProcess: FeeProcess;
  confirmationMechanism: string;
  // Whether an automated status-polling/webhook mechanism exists at
  // all for this method -- OTHER/PHYSICAL_MAIL typically don't, and
  // that absence must be explicit rather than silently assumed away.
  hasStatusMechanism: boolean;
  supportsRetry: boolean;
  requiresManualSteps: boolean;
  supportedOperations: readonly string[];
}

export const FILING_METHODS: Record<FilingMethodKey, FilingMethodConfig> = {
  ONLINE_PORTAL: {
    key: "ONLINE_PORTAL",
    displayName: "Online Portal",
    description: "Submission through a state/authority-hosted web portal.",
    submissionMechanism: "Automated form fill + upload via portal session",
    requiredMetadata: ["claimant_identity", "case_reference"],
    requiredDocumentFormats: ["PDF"],
    authenticationRequired: true,
    feeProcess: "PAID_BEFORE_SUBMISSION",
    confirmationMechanism: "Portal confirmation page/number",
    hasStatusMechanism: true,
    supportsRetry: true,
    requiresManualSteps: false,
    supportedOperations: ["submit", "get_status", "get_confirmation", "cancel"],
  },
  API: {
    key: "API",
    displayName: "Provider API",
    description: "Direct machine-to-machine submission via a provider's API.",
    submissionMechanism: "Authenticated API request",
    requiredMetadata: ["claimant_identity", "case_reference"],
    requiredDocumentFormats: ["PDF", "JSON"],
    authenticationRequired: true,
    feeProcess: "PAID_AFTER_SUBMISSION",
    confirmationMechanism: "API response with external filing ID",
    hasStatusMechanism: true,
    supportsRetry: true,
    requiresManualSteps: false,
    supportedOperations: ["validate", "submit", "get_status", "get_confirmation", "cancel", "retrieve_receipt"],
  },
  ELECTRONIC_PROVIDER: {
    key: "ELECTRONIC_PROVIDER",
    displayName: "Electronic Filing Provider",
    description: "A third-party e-filing provider/service acting as an intermediary.",
    submissionMechanism: "Provider-managed electronic submission",
    requiredMetadata: ["claimant_identity", "case_reference", "provider_account"],
    requiredDocumentFormats: ["PDF"],
    authenticationRequired: true,
    feeProcess: "PAID_BEFORE_SUBMISSION",
    confirmationMechanism: "Provider confirmation + external filing ID",
    hasStatusMechanism: true,
    supportsRetry: true,
    requiresManualSteps: false,
    supportedOperations: ["submit", "get_status", "get_confirmation", "retrieve_receipt"],
  },
  EMAIL_SUBMISSION: {
    key: "EMAIL_SUBMISSION",
    displayName: "Email Submission",
    description: "Submission by sending the package to an authority-designated email address.",
    submissionMechanism: "Outbound email with attached package",
    requiredMetadata: ["claimant_identity", "case_reference", "recipient_email"],
    requiredDocumentFormats: ["PDF"],
    authenticationRequired: false,
    feeProcess: "PAID_AFTER_ACCEPTANCE",
    confirmationMechanism: "Read receipt or manual acknowledgment",
    hasStatusMechanism: false,
    supportsRetry: false,
    requiresManualSteps: true,
    supportedOperations: ["submit"],
  },
  SECURE_UPLOAD: {
    key: "SECURE_UPLOAD",
    displayName: "Secure Upload",
    description: "Upload to an authority-provided secure file-transfer endpoint.",
    submissionMechanism: "Authenticated secure upload",
    requiredMetadata: ["claimant_identity", "case_reference"],
    requiredDocumentFormats: ["PDF"],
    authenticationRequired: true,
    feeProcess: "NONE",
    confirmationMechanism: "Upload receipt / transfer confirmation",
    hasStatusMechanism: false,
    supportsRetry: true,
    requiresManualSteps: false,
    supportedOperations: ["submit", "retrieve_receipt"],
  },
  PHYSICAL_MAIL: {
    key: "PHYSICAL_MAIL",
    displayName: "Physical Mail",
    description: "Submission by physical mail to the filing authority.",
    submissionMechanism: "Printed package mailed via a configured carrier",
    requiredMetadata: ["claimant_identity", "case_reference", "mailing_address"],
    requiredDocumentFormats: ["PDF"],
    authenticationRequired: false,
    feeProcess: "NONE",
    confirmationMechanism: "Carrier tracking / delivery confirmation, manually entered",
    hasStatusMechanism: false,
    supportsRetry: false,
    requiresManualSteps: true,
    supportedOperations: ["submit"],
  },
  OTHER: {
    key: "OTHER",
    displayName: "Other Configured Method",
    description: "A filing method not yet fully configured -- always requires manual handling rather than guessing.",
    submissionMechanism: "Manual, operator-driven",
    requiredMetadata: [],
    requiredDocumentFormats: [],
    authenticationRequired: false,
    feeProcess: "NONE",
    confirmationMechanism: "Manual entry",
    hasStatusMechanism: false,
    supportsRetry: false,
    requiresManualSteps: true,
    supportedOperations: [],
  },
};

export function getFilingMethodConfig(key: string): FilingMethodConfig | null {
  return (FILING_METHODS as Record<string, FilingMethodConfig>)[key] ?? null;
}

/**
 * A method only "supports" an operation if it's explicitly listed --
 * doc 08 section 8's "the connector must explicitly report unsupported
 * operations" applies at the method-config level too, not just the
 * connector interface.
 */
export function methodSupportsOperation(key: string, operation: string): boolean {
  const config = getFilingMethodConfig(key);
  return config?.supportedOperations.includes(operation) ?? false;
}
