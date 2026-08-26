// Wires trackerImport.ts's pure decisions to the live DB + live Sheet.
// Not unit-tested directly -- it's Prisma/Sheets calls with no branching
// logic of its own; planImportForRow (tested) is where the logic lives.
//
// Currently invoked manually (see scripts/run-tracker-import.mjs), not on
// a schedule -- matches docs/decisions/sheets-integration.md leaving the
// exact sync mechanism (scheduled vs. manual "promote" action) as an
// implementation detail. Wiring it into a cron/BullMQ job is a small
// follow-up once someone actually wants it running unattended.
import type { PrismaClient } from "@prisma/client";
import { fetchTrackerRows } from "./sheetsClient";
import { planImportForRow, type ImportOutcome } from "./trackerImport";
import { recordAuditEvent, type AuditEventWriter } from "./audit";

export interface TrackerImportSummary {
  created: number;
  skipped: number;
  duplicates: number;
  outcomes: ImportOutcome[];
}

const SYSTEM_USER_EMAIL = "system-tracker-import@internal.rosenthalandkin.local";

/**
 * Finds or creates the placeholder User row that system-authored Notes
 * are attributed to. Note.authorId is a required FK, and there's no real
 * "system" actor concept yet (P0-6's auth endpoint isn't wired up) -- this
 * is that concept's minimal stand-in until one exists. passwordHash is a
 * random, never-used value; this user is never a valid login.
 */
async function getOrCreateSystemUser(db: PrismaClient): Promise<string> {
  const existing = await db.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
  if (existing) return existing.id;

  const created = await db.user.create({
    data: {
      email: SYSTEM_USER_EMAIL,
      name: "System (Sheets Tracker Import)",
      passwordHash: "system-account-not-a-real-login",
      role: "READ_ONLY",
    },
  });
  return created.id;
}

export async function runTrackerImport(
  db: PrismaClient,
  spreadsheetId: string
): Promise<TrackerImportSummary> {
  const [rows, existingEstates, importedRows, systemUserId] = await Promise.all([
    fetchTrackerRows(spreadsheetId),
    db.estate.findMany({
      select: { id: true, decedentName: true, jurisdiction: true, probateCaseNumber: true },
    }),
    db.estate.findMany({
      where: { sourceTrackerRowId: { not: null } },
      select: { sourceTrackerRowId: true },
    }),
    getOrCreateSystemUser(db),
  ]);

  const alreadyImported = new Set(
    importedRows.map((r) => r.sourceTrackerRowId).filter((id): id is string => Boolean(id))
  );

  let nextCaseSequence = (await db.estate.count()) + 1;
  const outcomes: ImportOutcome[] = [];

  for (const row of rows) {
    const outcome = planImportForRow(
      row,
      existingEstates.map((e) => ({
        id: e.id,
        decedentName: e.decedentName,
        jurisdiction: e.jurisdiction,
        probateCaseNumber: e.probateCaseNumber,
      })),
      alreadyImported,
      nextCaseSequence
    );
    outcomes.push(outcome);

    if (outcome.kind !== "CREATE") continue;

    nextCaseSequence += 1;
    alreadyImported.add(outcome.estate.sourceTrackerRowId);

    const person = await db.person.create({ data: outcome.person });
    const estate = await db.estate.create({ data: outcome.estate });
    await db.claimant.create({
      data: { ...outcome.claimant, estateId: estate.id, personId: person.id },
    });
    await db.note.create({
      data: {
        estateId: estate.id,
        authorId: systemUserId,
        content: `Imported from heir-finder-tracker row ${outcome.estate.sourceTrackerRowId}. Raw row: ${outcome.note}`,
      },
    });
    // Prisma's generated create() signature is stricter than
    // AuditEventWriter's intentionally loose one (used so audit.ts can be
    // unit-tested without a live DB) -- structurally compatible at
    // runtime, not assignable per TS's parameter variance rules.
    await recordAuditEvent(db as unknown as AuditEventWriter, {
      entityType: "Estate",
      entityId: estate.id,
      eventType: "CREATED",
      actorUserId: systemUserId,
      newValue: outcome.estate,
      metadata: { source: "tracker-import", leadId: outcome.estate.sourceTrackerRowId },
    });
  }

  return {
    created: outcomes.filter((o) => o.kind === "CREATE").length,
    skipped: outcomes.filter((o) => o.kind === "SKIPPED").length,
    duplicates: outcomes.filter((o) => o.kind === "DUPLICATE").length,
    outcomes,
  };
}
