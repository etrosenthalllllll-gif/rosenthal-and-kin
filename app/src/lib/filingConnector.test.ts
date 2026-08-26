import { describe, it, expect } from "vitest";
import {
  connectorSupportsOperation,
  resolveConnector,
  createInMemoryFilingConnector,
  type ConnectorRegistryEntry,
} from "./filingConnector";

describe("filing connector", () => {
  it("reports supported operations explicitly, never inferring from method presence", () => {
    const connector = createInMemoryFilingConnector("test-connector", ["CA"]);
    expect(connectorSupportsOperation(connector, "submit")).toBe(true);
    expect(connectorSupportsOperation(connector, "get_status")).toBe(true);
    expect(connectorSupportsOperation(connector, "cancel")).toBe(false);
  });

  it("submits and tracks status via the in-memory reference connector", async () => {
    const connector = createInMemoryFilingConnector("test-connector", ["CA"]);
    const result = await connector.submit("submission-1");
    expect(result.externalFilingId).toContain("test-connector");
    const status = await connector.getStatus(result.externalFilingId);
    expect(status.normalizedStatus).toBe("SUBMITTED");
  });

  it("getStatus reports UNKNOWN for an id that was never submitted", async () => {
    const connector = createInMemoryFilingConnector("test-connector", ["CA"]);
    const status = await connector.getStatus("never-submitted");
    expect(status.normalizedStatus).toBe("UNKNOWN");
  });
});

describe("connector registry resolution", () => {
  const connectorA = createInMemoryFilingConnector("connector-a", ["CA"]);
  const connectorB = createInMemoryFilingConnector("connector-b", ["CA"]);

  it("resolves a single matching registry entry", () => {
    const registry: ConnectorRegistryEntry[] = [{ jurisdiction: "CA", connector: connectorA }];
    const result = resolveConnector({ jurisdiction: "CA" }, registry);
    expect(result.outcome).toBe("RESOLVED");
    expect(result.connector?.connectorId).toBe("connector-a");
  });

  it("reports NOT_FOUND when no entry matches the jurisdiction", () => {
    const registry: ConnectorRegistryEntry[] = [{ jurisdiction: "CA", connector: connectorA }];
    const result = resolveConnector({ jurisdiction: "NV" }, registry);
    expect(result.outcome).toBe("NOT_FOUND");
  });

  it("a claim-type-scoped entry only matches its claim type", () => {
    const registry: ConnectorRegistryEntry[] = [
      { jurisdiction: "CA", claimType: "UNCLAIMED_PROPERTY", connector: connectorA },
    ];
    const matched = resolveConnector({ jurisdiction: "CA", claimType: "UNCLAIMED_PROPERTY" }, registry);
    expect(matched.outcome).toBe("RESOLVED");

    const unmatched = resolveConnector({ jurisdiction: "CA", claimType: "ESTATE_CLAIM" }, registry);
    expect(unmatched.outcome).toBe("NOT_FOUND");
  });

  it("reports AMBIGUOUS rather than guessing when two entries equally match", () => {
    const registry: ConnectorRegistryEntry[] = [
      { jurisdiction: "CA", connector: connectorA },
      { jurisdiction: "CA", connector: connectorB },
    ];
    const result = resolveConnector({ jurisdiction: "CA" }, registry);
    expect(result.outcome).toBe("AMBIGUOUS");
    expect(result.candidates).toHaveLength(2);
    expect(result.connector).toBeNull();
  });
});
