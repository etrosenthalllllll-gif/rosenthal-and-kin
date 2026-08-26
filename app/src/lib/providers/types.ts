// Provider abstractions -- doc 01 Phase 11 / doc 04 section 32.
//
// "Do not hard-code provider-specific logic throughout the application.
// Create provider abstractions/interfaces where appropriate ... The
// application should interact with the abstraction rather than being
// deeply coupled to one vendor."
//
// No vendor-specific code lives here or is imported here. Concrete
// implementations (Twilio, PostGrid, S3, Anthropic, a CA filing
// connector, a payment processor) get built in their own files once the
// corresponding provider account exists (see PLAN.md P0-10 and the
// per-phase credential blockers). Every implementation must satisfy one
// of these interfaces -- the rest of the app only ever depends on the
// interface, never the concrete class.

// --- Communications (doc 04) ----------------------------------------------

export type CommunicationChannel = "EMAIL" | "SMS" | "VOICE" | "MAIL";

export interface OutboundMessage {
  channel: CommunicationChannel;
  to: string;
  subject?: string;
  body: string;
  idempotencyKey: string; // required -- see doc 04 section 34, no exceptions
}

export interface SendResult {
  providerMessageId: string;
  status: "QUEUED" | "SENT" | "FAILED";
  raw?: unknown;
}

export interface CommunicationProvider {
  channel: CommunicationChannel;
  send(message: OutboundMessage): Promise<SendResult>;
  getStatus(providerMessageId: string): Promise<SendResult["status"]>;
}

// --- Document storage (doc 01 Phase 9) ------------------------------------

export interface UploadedObject {
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
}

export interface DocumentStorageProvider {
  put(key: string, data: Buffer, mimeType: string): Promise<UploadedObject>;
  getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

// --- AI (doc 01 Phase 11, doc 06 confidence engine) -----------------------

export interface AIRequest {
  prompt: string;
  context?: Record<string, unknown>;
  model?: string;
}

export interface AIResponse {
  text: string;
  model: string;
  confidence?: number; // 0.0-1.0, when the task produces one
  raw?: unknown;
}

export interface AIProvider {
  complete(request: AIRequest): Promise<AIResponse>;
}

// --- Filing (doc 08) -------------------------------------------------------
//
// Superseded by filingConnector.ts's richer `FilingConnector` interface
// (P7-4), built once doc 08 was read in full -- this original stub
// predates that read and nothing in the codebase depends on it. Left
// here, unused, rather than deleted, so a future reader searching this
// file for "Filing" still finds a pointer to where the real interface
// now lives.

export interface FilingSubmission {
  filingId: string;
  jurisdiction: string;
  packageStorageKeys: string[];
  idempotencyKey: string;
}

export interface FilingResult {
  externalFilingId: string;
  status: "SUBMITTED" | "RECEIVED" | "REJECTED" | "UNKNOWN";
  raw?: unknown;
}

/** @deprecated superseded by FilingConnector in filingConnector.ts (P7-4) */
export interface FilingProvider {
  jurisdiction: string;
  submit(submission: FilingSubmission): Promise<FilingResult>;
  getStatus(externalFilingId: string): Promise<FilingResult["status"]>;
}

// --- Payment (doc 10) -------------------------------------------------------

export interface PaymentRequest {
  amountCents: number;
  currency: string; // ISO 4217, e.g. "USD" -- doc 10 section 59, never assume USD
  idempotencyKey: string;
  reference: string;
}

export interface PaymentResult {
  transactionId: string;
  status: "PENDING" | "PAID" | "FAILED";
  raw?: unknown;
}

export interface PaymentProvider {
  charge(request: PaymentRequest): Promise<PaymentResult>;
  getStatus(transactionId: string): Promise<PaymentResult["status"]>;
}
