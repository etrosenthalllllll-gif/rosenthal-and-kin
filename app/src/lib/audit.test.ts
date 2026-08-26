import { describe, it, expect, vi } from "vitest";
import { recordAuditEvent, InvalidAuditEventError } from "./audit";

function makeFakeDb() {
  const created: unknown[] = [];
  return {
    db: {
      auditEvent: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: "fake-id", ...data };
        }),
      },
    },
    created,
  };
}

describe("recordAuditEvent", () => {
  it("writes an audit event with all fields populated", async () => {
    const { db, created } = makeFakeDb();

    await recordAuditEvent(db, {
      entityType: "Claimant",
      entityId: "claimant-1",
      eventType: "STATUS_CHANGED",
      actorUserId: "user-1",
      previousValue: { status: "LEAD" },
      newValue: { status: "CONTACTED" },
      correlationId: "corr-1",
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      entityType: "Claimant",
      entityId: "claimant-1",
      eventType: "STATUS_CHANGED",
      actorUserId: "user-1",
      previousValue: { status: "LEAD" },
      newValue: { status: "CONTACTED" },
      correlationId: "corr-1",
    });
  });

  it("defaults optional fields to null rather than undefined", async () => {
    const { db, created } = makeFakeDb();

    await recordAuditEvent(db, {
      entityType: "Estate",
      entityId: "estate-1",
      eventType: "CREATED",
    });

    expect(created[0]).toMatchObject({
      actorUserId: null,
      previousValue: null,
      newValue: null,
      metadata: null,
      correlationId: null,
    });
  });

  it("refuses to write an event missing entityType", async () => {
    const { db } = makeFakeDb();
    await expect(
      recordAuditEvent(db, {
        entityType: "",
        entityId: "x",
        eventType: "CREATED",
      })
    ).rejects.toThrow(InvalidAuditEventError);
  });

  it("refuses to write an event missing eventType", async () => {
    const { db } = makeFakeDb();
    await expect(
      recordAuditEvent(db, {
        entityType: "Estate",
        entityId: "x",
        eventType: "",
      })
    ).rejects.toThrow(InvalidAuditEventError);
  });

  it("never calls db.create when validation fails", async () => {
    const { db } = makeFakeDb();
    await expect(
      recordAuditEvent(db, { entityType: "Estate", entityId: "", eventType: "CREATED" })
    ).rejects.toThrow();
    expect(db.auditEvent.create).not.toHaveBeenCalled();
  });
});
