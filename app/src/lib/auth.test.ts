import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  hasPermission,
  requirePermission,
  PermissionDeniedError,
} from "./auth";

describe("password hashing", () => {
  it("hashes and verifies a valid password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toBe("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-entirely", hash)).toBe(false);
  });

  it("rejects passwords shorter than 12 characters", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });

  it("never stores the plaintext in the hash", async () => {
    const hash = await hashPassword("another-long-enough-password");
    expect(hash.includes("another-long-enough-password")).toBe(false);
  });
});

describe("role-based permissions", () => {
  it("ADMIN has every defined permission", () => {
    expect(hasPermission("ADMIN", "MANAGE_USERS")).toBe(true);
    expect(hasPermission("ADMIN", "FILE_CLAIMS")).toBe(true);
    expect(hasPermission("ADMIN", "VIEW_AUDIT_LOGS")).toBe(true);
  });

  it("OPERATOR can edit cases and send communications but not manage users", () => {
    expect(hasPermission("OPERATOR", "EDIT_CASES")).toBe(true);
    expect(hasPermission("OPERATOR", "SEND_COMMUNICATIONS")).toBe(true);
    expect(hasPermission("OPERATOR", "MANAGE_USERS")).toBe(false);
    expect(hasPermission("OPERATOR", "FILE_CLAIMS")).toBe(false);
  });

  it("READ_ONLY cannot edit, upload, or approve anything", () => {
    expect(hasPermission("READ_ONLY", "VIEW_CASES")).toBe(true);
    expect(hasPermission("READ_ONLY", "EDIT_CASES")).toBe(false);
    expect(hasPermission("READ_ONLY", "UPLOAD_DOCUMENTS")).toBe(false);
    expect(hasPermission("READ_ONLY", "APPROVE_CLAIMS")).toBe(false);
  });

  it("requirePermission throws PermissionDeniedError for a disallowed action", () => {
    expect(() => requirePermission("READ_ONLY", "DELETE_DOCUMENTS")).toThrow(
      PermissionDeniedError
    );
  });

  it("requirePermission does not throw for an allowed action", () => {
    expect(() => requirePermission("REVIEWER", "APPROVE_CLAIMS")).not.toThrow();
  });

  // --- doc 10 section 57's fine-grained financial permissions (P9-17) ---

  it("OPERATOR can do routine financial preparation but not approve/refund/close", () => {
    expect(hasPermission("OPERATOR", "CALCULATE_FEES")).toBe(true);
    expect(hasPermission("OPERATOR", "CREATE_INVOICE")).toBe(true);
    expect(hasPermission("OPERATOR", "RECORD_PAYMENT")).toBe(true);
    expect(hasPermission("OPERATOR", "APPROVE_DISTRIBUTION")).toBe(false);
    expect(hasPermission("OPERATOR", "REFUND_PAYMENT")).toBe(false);
    expect(hasPermission("OPERATOR", "CLOSE_FINANCIAL_CASE")).toBe(false);
  });

  it("every role can escalate a financial exception -- never gated behind a higher tier", () => {
    expect(hasPermission("OPERATOR", "ESCALATE_FINANCIAL_EXCEPTION")).toBe(true);
    expect(hasPermission("REVIEWER", "ESCALATE_FINANCIAL_EXCEPTION")).toBe(true);
    expect(hasPermission("ADMIN", "ESCALATE_FINANCIAL_EXCEPTION")).toBe(true);
  });

  it("REVIEWER can approve distributions/adjustments and close/reopen financial cases", () => {
    expect(hasPermission("REVIEWER", "APPROVE_DISTRIBUTION")).toBe(true);
    expect(hasPermission("REVIEWER", "APPROVE_ADJUSTMENT")).toBe(true);
    expect(hasPermission("REVIEWER", "CLOSE_FINANCIAL_CASE")).toBe(true);
    expect(hasPermission("REVIEWER", "REOPEN_FINANCIAL_CASE")).toBe(true);
  });

  it("READ_ONLY has none of the fine-grained financial permissions", () => {
    expect(hasPermission("READ_ONLY", "CALCULATE_FEES")).toBe(false);
    expect(hasPermission("READ_ONLY", "RECORD_PAYMENT")).toBe(false);
    expect(hasPermission("READ_ONLY", "ESCALATE_FINANCIAL_EXCEPTION")).toBe(false);
  });

  // --- decision-queue action permissions ---

  it("OPERATOR can decide routine decisions but not high-consequence ones", () => {
    expect(hasPermission("OPERATOR", "DECIDE_ROUTINE_DECISIONS")).toBe(true);
    expect(hasPermission("OPERATOR", "DECIDE_HIGH_CONSEQUENCE_DECISIONS")).toBe(false);
  });

  it("REVIEWER and ADMIN can decide both routine and high-consequence decisions", () => {
    expect(hasPermission("REVIEWER", "DECIDE_ROUTINE_DECISIONS")).toBe(true);
    expect(hasPermission("REVIEWER", "DECIDE_HIGH_CONSEQUENCE_DECISIONS")).toBe(true);
    expect(hasPermission("ADMIN", "DECIDE_ROUTINE_DECISIONS")).toBe(true);
    expect(hasPermission("ADMIN", "DECIDE_HIGH_CONSEQUENCE_DECISIONS")).toBe(true);
  });

  it("READ_ONLY cannot decide any decision or add case notes", () => {
    expect(hasPermission("READ_ONLY", "DECIDE_ROUTINE_DECISIONS")).toBe(false);
    expect(hasPermission("READ_ONLY", "DECIDE_HIGH_CONSEQUENCE_DECISIONS")).toBe(false);
    expect(hasPermission("READ_ONLY", "ADD_CASE_NOTES")).toBe(false);
  });

  it("every non-read-only role can add case notes", () => {
    expect(hasPermission("OPERATOR", "ADD_CASE_NOTES")).toBe(true);
    expect(hasPermission("REVIEWER", "ADD_CASE_NOTES")).toBe(true);
    expect(hasPermission("ADMIN", "ADD_CASE_NOTES")).toBe(true);
  });
});
