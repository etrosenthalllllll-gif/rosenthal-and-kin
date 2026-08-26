// Genealogy graph + relationship-path calculation + completeness --
// doc 06 sections 9-10, 25. PLAN.md P5-4.
//
// "Build a relationship graph... Every edge must be linked to
// evidence." / "Support relationships across multiple generations...
// The system should calculate relationship paths... Each edge must
// independently have evidence. Do not treat a chain as verified merely
// because each person's record exists." / "Calculate whether the
// genealogy graph appears complete enough for the current workflow...
// This should feed the research workflow."
//
// Pure graph logic over the existing Relationship rows (schema.prisma,
// P0-2/P5-1) -- no DB access. Only PARENT_OF/CHILD_OF edges are walked
// for lineage paths; SPOUSE_OF and sibling-type edges describe the
// graph but aren't part of a "descends from" chain, so they're
// excluded from path-finding on purpose rather than by omission.

export type LineageEdgeType = "PARENT_OF" | "CHILD_OF";

export interface GenealogyEdge {
  personAId: string;
  personBId: string;
  type: LineageEdgeType;
  // Every edge must independently have evidence -- doc 06 section 9/10:
  // "Do not treat a chain as verified merely because each person's
  // record exists." An edge with no evidence still exists in the graph
  // (it can be researched later) but can't count toward a verified path.
  hasEvidence: boolean;
}

export interface RelationshipPath {
  // Person IDs from the starting person to the target, inclusive.
  personIds: string[];
  // True only when every edge along the path has evidence attached.
  fullyEvidenced: boolean;
}

function childToParentEdges(edges: readonly GenealogyEdge[]): Map<string, GenealogyEdge[]> {
  // Normalize both PARENT_OF and CHILD_OF into "child -> parent" lookup
  // so path-finding only has to walk one direction.
  const map = new Map<string, GenealogyEdge[]>();
  const add = (childId: string, edge: GenealogyEdge) => {
    const existing = map.get(childId) ?? [];
    existing.push(edge);
    map.set(childId, existing);
  };

  for (const edge of edges) {
    if (edge.type === "PARENT_OF") {
      add(edge.personBId, edge); // A is parent of B -> B's parent is A
    } else {
      add(edge.personAId, edge); // A is child of B -> A's parent is B
    }
  }

  return map;
}

function parentIdOf(edge: GenealogyEdge, childId: string): string {
  if (edge.type === "PARENT_OF") return edge.personAId;
  return edge.personBId;
}

/**
 * Pure: doc 06 section 10 -- finds a descent path from `fromPersonId`
 * up through ancestors to `toPersonId` (e.g. claimant -> decedent).
 * Breadth-first so the shortest path wins when more than one exists.
 * Returns null when no path exists in the graph at all -- not the same
 * as an unevidenced path, which is returned with `fullyEvidenced: false`.
 */
export function findLineagePath(
  edges: readonly GenealogyEdge[],
  fromPersonId: string,
  toPersonId: string
): RelationshipPath | null {
  if (fromPersonId === toPersonId) {
    return { personIds: [fromPersonId], fullyEvidenced: true };
  }

  const childToParent = childToParentEdges(edges);
  const visited = new Set<string>([fromPersonId]);
  const queue: { personId: string; path: string[]; evidenced: boolean }[] = [
    { personId: fromPersonId, path: [fromPersonId], evidenced: true },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const parentEdges = childToParent.get(current.personId) ?? [];

    for (const edge of parentEdges) {
      const parentId = parentIdOf(edge, current.personId);
      if (visited.has(parentId)) continue;
      visited.add(parentId);

      const nextPath = [...current.path, parentId];
      const nextEvidenced = current.evidenced && edge.hasEvidence;

      if (parentId === toPersonId) {
        return { personIds: nextPath, fullyEvidenced: nextEvidenced };
      }

      queue.push({ personId: parentId, path: nextPath, evidenced: nextEvidenced });
    }
  }

  return null;
}

export interface GenealogyCompletenessResult {
  complete: boolean;
  // Person IDs that are known to exist in the graph but whose own
  // descendant/ancestor branch hasn't been researched yet -- doc 06
  // section 25's own "Child B's descendants are unknown" example.
  unresearchedBranches: string[];
  reason: string;
}

/**
 * Pure: doc 06 section 25 -- a graph can name every known relative and
 * still be "incomplete" if a branch hasn't been researched at all.
 * `knownLeafPersonIds` are the people the case currently treats as
 * having no further descendants recorded; a leaf is "unresearched"
 * (not "childless") when the caller hasn't explicitly marked it as
 * researched-and-confirmed-childless.
 */
export function checkGenealogyCompleteness(
  knownLeafPersonIds: readonly string[],
  researchedAndConfirmedChildlessIds: ReadonlySet<string>
): GenealogyCompletenessResult {
  const unresearchedBranches = knownLeafPersonIds.filter(
    (id) => !researchedAndConfirmedChildlessIds.has(id)
  );

  if (unresearchedBranches.length === 0) {
    return {
      complete: true,
      unresearchedBranches: [],
      reason: "Every known branch has been researched.",
    };
  }

  return {
    complete: false,
    unresearchedBranches,
    reason: `${unresearchedBranches.length} branch(es) have not been researched for further descendants.`,
  };
}
