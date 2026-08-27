// Password hashing + role-based permission checks — doc 01 Phase 7-8.
//
// "Do not invent custom cryptography. Use established security libraries."
// bcrypt is the established library here; nothing home-rolled.
//
// "Do not rely only on hiding buttons in the frontend. Enforce authorization
// on the backend/API as well." — requirePermission() below is the backend
// enforcement point; every API route must call it, not just the UI.

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  if (plaintext.length < 12) {
    throw new Error("Password must be at least 12 characters");
  }
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export type UserRole = "ADMIN" | "OPERATOR" | "REVIEWER" | "READ_ONLY";

export type Permission =
  | "VIEW_CASES"
  | "EDIT_CASES"
  | "VIEW_DOCUMENTS"
  | "UPLOAD_DOCUMENTS"
  | "DELETE_DOCUMENTS"
  | "SEND_COMMUNICATIONS"
  | "APPROVE_CLAIMS"
  | "FILE_CLAIMS"
  | "VIEW_FINANCIAL_DATA"
  | "MANAGE_USERS"
  | "MANAGE_INTEGRATIONS"
  | "VIEW_AUDIT_LOGS"
  | "CONFIGURE_WORKFLOWS"
  // doc 10 section 57's own fine-grained financial permission list --
  // "do not give every operator unrestricted financial permissions."
  // Kept separate from VIEW_FINANCIAL_DATA (already existed) rather
  // than folding every financial action under one blanket flag.
  | "CALCULATE_FEES"
  | "CREATE_INVOICE"
  | "ISSUE_INVOICE"
  | "RECORD_PAYMENT"
  | "APPROVE_DISTRIBUTION"
  | "APPROVE_ADJUSTMENT"
  | "REFUND_PAYMENT"
  | "CLOSE_FINANCIAL_CASE"
  | "REOPEN_FINANCIAL_CASE"
  | "ESCALATE_FINANCIAL_EXCEPTION"
  // doc 12 section 79's own monitoring-permission examples ("Operator:
  // view alerts related to assigned work. Manager: view system health
  // and incidents. Administrator: configure thresholds and
  // remediation. Only authorized users can: suppress alerts, change
  // thresholds, disable monitoring, execute remediation, resolve
  // incidents.") -- this codebase doesn't have a separate "Manager"
  // role, so REVIEWER (the existing higher-trust non-admin role) is
  // the closest fit for that tier.
  | "VIEW_MONITORING"
  | "CONFIGURE_MONITORING"
  | "EXECUTE_REMEDIATION"
  | "SUPPRESS_ALERTS"
  | "RESOLVE_INCIDENTS"
  // doc 13 section 84's own export-gating requirement -- analytics
  // exports carry the same financial/case sensitivity as the reports
  // they're built from, so this is not granted by VIEW_CASES alone.
  | "EXPORT_ANALYTICS_DATA"
  // doc 02's decision-queue actions (Approve/Reject/Revise/Escalate,
  // etc. -- src/lib/decisionWorkflow.ts). Split into two tiers rather
  // than one blanket "act on decisions" permission: routine decisions
  // (outreach, document requests) are open to every non-read-only
  // role, but a decision type flagged `highConsequence` in
  // decisionTypes.ts (filing, financial distribution, case closure)
  // additionally requires the higher tier -- same
  // OPERATOR-can't-approve/REVIEWER-can pattern already established
  // for the financial permissions above, applied to the decision
  // queue itself.
  | "DECIDE_ROUTINE_DECISIONS"
  | "DECIDE_HIGH_CONSEQUENCE_DECISIONS"
  // Adding an operator note to a case (Note model) -- routine, but
  // still not a READ_ONLY action.
  | "ADD_CASE_NOTES";

// Explicit allow-list per role. A role not listed for a permission is
// denied by default — this is deliberately fail-closed, matching doc 01's
// "the system must block progression and escalate" philosophy applied to
// permissions rather than legal rules.
const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set([
    "VIEW_CASES",
    "EDIT_CASES",
    "VIEW_DOCUMENTS",
    "UPLOAD_DOCUMENTS",
    "DELETE_DOCUMENTS",
    "SEND_COMMUNICATIONS",
    "APPROVE_CLAIMS",
    "FILE_CLAIMS",
    "VIEW_FINANCIAL_DATA",
    "MANAGE_USERS",
    "MANAGE_INTEGRATIONS",
    "VIEW_AUDIT_LOGS",
    "CONFIGURE_WORKFLOWS",
    "CALCULATE_FEES",
    "CREATE_INVOICE",
    "ISSUE_INVOICE",
    "RECORD_PAYMENT",
    "APPROVE_DISTRIBUTION",
    "APPROVE_ADJUSTMENT",
    "REFUND_PAYMENT",
    "CLOSE_FINANCIAL_CASE",
    "REOPEN_FINANCIAL_CASE",
    "ESCALATE_FINANCIAL_EXCEPTION",
    "VIEW_MONITORING",
    "CONFIGURE_MONITORING",
    "EXECUTE_REMEDIATION",
    "SUPPRESS_ALERTS",
    "RESOLVE_INCIDENTS",
    "EXPORT_ANALYTICS_DATA",
    "DECIDE_ROUTINE_DECISIONS",
    "DECIDE_HIGH_CONSEQUENCE_DECISIONS",
    "ADD_CASE_NOTES",
  ]),
  OPERATOR: new Set([
    "VIEW_CASES",
    "EDIT_CASES",
    "VIEW_DOCUMENTS",
    "UPLOAD_DOCUMENTS",
    "SEND_COMMUNICATIONS",
    "VIEW_FINANCIAL_DATA",
    // Routine financial preparation work -- not the consequential
    // approve/refund/close actions below.
    "CALCULATE_FEES",
    "CREATE_INVOICE",
    "RECORD_PAYMENT",
    "ESCALATE_FINANCIAL_EXCEPTION",
    // doc 12 §79's Operator tier: view only, no configure/suppress/
    // remediate/resolve authority.
    "VIEW_MONITORING",
    // Routine decisions only -- highConsequence ones need REVIEWER/ADMIN.
    "DECIDE_ROUTINE_DECISIONS",
    "ADD_CASE_NOTES",
  ]),
  REVIEWER: new Set([
    "VIEW_CASES",
    "VIEW_DOCUMENTS",
    "APPROVE_CLAIMS",
    "FILE_CLAIMS",
    "VIEW_FINANCIAL_DATA",
    "VIEW_AUDIT_LOGS",
    // The higher-trust approval/closure actions -- doc 10 section 57's
    // "do not give every operator unrestricted financial permissions"
    // applied by reserving these for Reviewer/Admin only.
    "ISSUE_INVOICE",
    "APPROVE_DISTRIBUTION",
    "APPROVE_ADJUSTMENT",
    "REFUND_PAYMENT",
    "CLOSE_FINANCIAL_CASE",
    "REOPEN_FINANCIAL_CASE",
    "ESCALATE_FINANCIAL_EXCEPTION",
    // doc 12 §79's Manager tier: view system health/incidents and
    // resolve them, but not configure thresholds or execute remediation
    // (Administrator-only per the doc).
    "VIEW_MONITORING",
    "RESOLVE_INCIDENTS",
    "EXPORT_ANALYTICS_DATA",
    "DECIDE_ROUTINE_DECISIONS",
    "DECIDE_HIGH_CONSEQUENCE_DECISIONS",
    "ADD_CASE_NOTES",
  ]),
  READ_ONLY: new Set(["VIEW_CASES", "VIEW_DOCUMENTS"]),
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export class PermissionDeniedError extends Error {
  constructor(public role: UserRole, public permission: Permission) {
    super(`Role ${role} does not have permission ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

/**
 * Backend enforcement point. Call this at the top of every API route that
 * performs a permissioned action — never rely on the frontend having
 * hidden the button.
 */
export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionDeniedError(role, permission);
  }
}
