import { describe, it, expect } from "vitest";
import {
  findLineagePath,
  checkGenealogyCompleteness,
  type GenealogyEdge,
} from "./genealogyGraph";

function edge(overrides: Partial<GenealogyEdge>): GenealogyEdge {
  return { personAId: "a", personBId: "b", type: "PARENT_OF", hasEvidence: true, ...overrides };
}

describe("findLineagePath", () => {
  it("returns a single-person path when from and to are the same person", () => {
    const result = findLineagePath([], "jane", "jane");
    expect(result).toEqual({ personIds: ["jane"], fullyEvidenced: true });
  });

  it("finds a direct parent-child path via a PARENT_OF edge", () => {
    const edges = [edge({ personAId: "john", personBId: "jane", type: "PARENT_OF" })];
    const result = findLineagePath(edges, "jane", "john");
    expect(result).toEqual({ personIds: ["jane", "john"], fullyEvidenced: true });
  });

  it("finds a direct path via a CHILD_OF edge (reverse direction)", () => {
    const edges = [edge({ personAId: "jane", personBId: "john", type: "CHILD_OF" })];
    const result = findLineagePath(edges, "jane", "john");
    expect(result).toEqual({ personIds: ["jane", "john"], fullyEvidenced: true });
  });

  it("finds a multi-generation path (doc 06 sec 10's example)", () => {
    const edges = [
      edge({ personAId: "mary", personBId: "jane", type: "PARENT_OF" }),
      edge({ personAId: "john", personBId: "mary", type: "PARENT_OF" }),
    ];
    const result = findLineagePath(edges, "jane", "john");
    expect(result?.personIds).toEqual(["jane", "mary", "john"]);
    expect(result?.fullyEvidenced).toBe(true);
  });

  it("marks a path as not fully evidenced when any edge lacks evidence", () => {
    const edges = [
      edge({ personAId: "mary", personBId: "jane", type: "PARENT_OF", hasEvidence: true }),
      edge({ personAId: "john", personBId: "mary", type: "PARENT_OF", hasEvidence: false }),
    ];
    const result = findLineagePath(edges, "jane", "john");
    expect(result?.fullyEvidenced).toBe(false);
  });

  it("returns null when no path exists in the graph", () => {
    const edges = [edge({ personAId: "john", personBId: "jane", type: "PARENT_OF" })];
    expect(findLineagePath(edges, "jane", "stranger")).toBeNull();
  });

  it("finds the shortest path when multiple exist", () => {
    const edges = [
      edge({ personAId: "grandpa", personBId: "dad", type: "PARENT_OF" }),
      edge({ personAId: "dad", personBId: "jane", type: "PARENT_OF" }),
      // A direct (shorter, evidence-supported elsewhere) shortcut claim:
      edge({ personAId: "grandpa", personBId: "jane", type: "PARENT_OF" }),
    ];
    const result = findLineagePath(edges, "jane", "grandpa");
    expect(result?.personIds).toEqual(["jane", "grandpa"]);
  });
});

describe("checkGenealogyCompleteness", () => {
  it("is complete when every known leaf has been researched", () => {
    const result = checkGenealogyCompleteness(["childA"], new Set(["childA"]));
    expect(result.complete).toBe(true);
  });

  it("is incomplete when a leaf hasn't been researched (doc 06 sec 25's own example)", () => {
    const result = checkGenealogyCompleteness(["childA", "childB"], new Set(["childA"]));
    expect(result.complete).toBe(false);
    expect(result.unresearchedBranches).toEqual(["childB"]);
  });

  it("is complete with no known leaves at all", () => {
    const result = checkGenealogyCompleteness([], new Set());
    expect(result.complete).toBe(true);
  });
});
