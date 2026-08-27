// Persists one operator decision action -- the DB-touching half of
// decisionWorkflow.ts's pure logic. Doc 02 section 6: "the operator's
// decision, the resulting status change, and (where applicable) the
// claimant transition must be recorded as one atomic operation,"
// alongside an audit event for each.
//
// Same pure-logic/thin-wrapper split as decisionQueue.ts: all the
// actual branching (which action maps to which status, whether the
// claimant machine also moves) already lives in decisionWorkflow.ts and
// is fully unit-tested there. This module only loads the current state,
// calls that logic, and writes the result -- wrapped in a single
// Prisma transaction so a decision can never end up "half applied"
// (status changed but the claimant transition lost, or vice versa).

import type { PrismaClient } from "@prisma/client";
import { applyDecisionAction, applyApproveClaimantDecision } from "./decisionWorkflow";
import type { DecisionStatus } from "./decisionStatus";
import type { ClaimantStatus } from "./stateMachine";
import { recordAuditEvent, type AuditEventWriter } from "./audit";

export class DecisionNotFoundError extends Error {
  constructor(decisionId: string) {
    super(`Decision not found: ${decisionId}`);
    this.name = "DecisionNotFoundError";
  }
}

export interface DecideOnDecisionInput {
  decisionId: string;
  action: string;
  reason?: string;
  actorUserId: string;
}

export interface DecideOnDecisionResult {
  newStatus: DecisionStatus;
  newClaimantStatus: ClaimantStatus | null;
}

/**
 * Loads the decision (and its claimant, for the one decision type that
 * drives the claimant lifecycle machine -- APPROVE_CLAIMANT), applies
 * the operator's action via the already-tested pure logic in
 * decisionWorkflow.ts, and persists everything -- Decision row,
 * ClaimantStateTransition + Claimant.status if the claimant moved, and
 * an AuditEvent for each -- inside one transaction.
 *
 * Real per-decision-type claimant wiring beyond APPROVE_CLAIMANT
 * (outreach -> CONTACTED, document received -> DOCUMENTS_COMPLETE,
 * etc.) is each pipeline phase's own job as it's built -- see
 * decisionWorkflow.ts's own note on this. Every other decision type
 * here updates the Decision record only, honestly, rather than
 * guessing at a claimant transition nothing has defined yet.
 */
export async function decideOnDecision(
  db: PrismaClient,
  input: DecideOnDecisionInput
): Promise<DecideOnDecisionResult> {
  return db.$transaction(async (tx) => {
    const decision = await tx.decision.findUnique({
      where: { id: input.decisionId },
      include: { claimant: true },
    });
    if (!decision) {
      throw new DecisionNotFoundError(input.decisionId);
    }

    let newStatus: DecisionStatus;
    let newClaimantStatus: ClaimantStatus | null = null;

    if (decision.decisionType === "APPROVE_CLAIMANT") {
      const result = applyApproveClaimantDecision({
        currentDecisionStatus: decision.status as DecisionStatus,
        currentClaimantStatus: decision.claimant.status as ClaimantStatus,
        action: input.action,
        reason: input.reason,
      });
      newStatus = result.newStatus;
      if (result.claimantStatus !== decision.claimant.status) {
        newClaimantStatus = result.claimantStatus;
      }
    } else {
      const result = applyDecisionAction({
        decisionType: decision.decisionType,
        currentStatus: decision.status as DecisionStatus,
        action: input.action,
        reason: input.reason,
      });
      newStatus = result.newStatus;
    }

    await tx.decision.update({
      where: { id: decision.id },
      data: {
        status: newStatus,
        selectedAction: input.action,
        reason: input.reason ?? null,
        decidedByUserId: input.actorUserId,
        decidedAt: new Date(),
      },
    });

    await recordAuditEvent(tx as unknown as AuditEventWriter, {
      entityType: "Decision",
      entityId: decision.id,
      eventType: "DECISION_ACTION_APPLIED",
      actorUserId: input.actorUserId,
      previousValue: { status: decision.status },
      newValue: { status: newStatus, action: input.action },
      metadata: input.reason ? { reason: input.reason } : undefined,
    });

    if (newClaimantStatus) {
      await tx.claimantStateTransition.create({
        data: {
          claimantId: decision.claimantId,
          fromStatus: decision.claimant.status,
          toStatus: newClaimantStatus,
          actor: input.actorUserId,
          reason: input.reason ?? null,
        },
      });
      await tx.claimant.update({
        where: { id: decision.claimantId },
        data: { status: newClaimantStatus },
      });
      await recordAuditEvent(tx as unknown as AuditEventWriter, {
        entityType: "Claimant",
        entityId: decision.claimantId,
        eventType: "STATUS_CHANGED",
        actorUserId: input.actorUserId,
        previousValue: { status: decision.claimant.status },
        newValue: { status: newClaimantStatus },
        metadata: { reason: input.reason ?? null, viaDecisionId: decision.id },
      });
    }

    return { newStatus, newClaimantStatus };
  });
}
