// Cross-source comparison + source independence -- doc 06 sections
// 11-13. PLAN.md P5-5.
//
// "Build a cross-source comparison engine. Compare facts from: Birth
// records, Death records, ... Claimant-provided documents, Existing
// case data, Communication statements, Other configured sources. For
// each important fact, create a source matrix... Result: CONSISTENT."
// / "Detect when multiple sources are not actually independent...
// Three websites all report the same obituary. That should not
// automatically count as three independent confirmations."
//
// Generalizes documentValidation.ts's compareFieldAcrossDocuments()
// (P4-5) beyond documents to any source doc 06 lists -- research,
// communications, case data -- and adds the independence-detection
// half that module didn't need (two documents are never "the same
// source republished," but a research source and a communication both
// citing one original obituary very much can be).

export interface SourceRecord {
  sourceId: string;
  value: string;
  // If this source is a copy or republication of another already-known
  // source, point to that source's ID -- doc 06 section 13's own
  // example (three websites reporting one obituary). Left unset when
  // the source is itself an origin.
  derivedFromSourceId?: string | null;
}

/**
 * Pure: resolves a source down to its ultimate origin by following
 * `derivedFromSourceId` links. A source with no such link is its own
 * origin. Guards against cycles (which shouldn't exist, but a cycle
 * must never turn into an infinite loop).
 */
function resolveOrigin(sourceId: string, byId: Map<string, SourceRecord>): string {
  const visited = new Set<string>();
  let current = sourceId;

  while (true) {
    if (visited.has(current)) return current; // cycle guard
    visited.add(current);
    const record = byId.get(current);
    if (!record?.derivedFromSourceId) return current;
    current = record.derivedFromSourceId;
  }
}

/**
 * Pure: doc 06 section 13 -- how many genuinely independent origins
 * exist among these sources? Three sources that all trace back to the
 * same origin count as one, not three.
 */
export function countIndependentSources(records: readonly SourceRecord[]): number {
  const byId = new Map(records.map((r) => [r.sourceId, r]));
  const origins = new Set(records.map((r) => resolveOrigin(r.sourceId, byId)));
  return origins.size;
}

export interface CrossSourceComparisonResult {
  status: "CONSISTENT" | "CONFLICT";
  // Every distinct normalized value and which sources reported it --
  // doc 06 section 14: "Do not silently choose one."
  distinctValues: { value: string; sourceIds: string[] }[];
  // The independent-origin count across ALL sources compared here,
  // regardless of which value they reported -- doc 06 section 12's own
  // "system confidence" input, kept separate from legal admissibility.
  independentSourceCount: number;
}

/**
 * Pure: doc 06 sections 11-12's source matrix for one fact, extended
 * with section 13's independence awareness. Groups sources by
 * normalized value; CONFLICT when more than one distinct value exists,
 * same as documentValidation.ts's compareFieldAcrossDocuments() but
 * over any source type, not just documents.
 */
export function compareAcrossSources(
  records: readonly SourceRecord[]
): CrossSourceComparisonResult {
  const groups = new Map<string, string[]>();

  for (const record of records) {
    if (!record.value) continue;
    const normalized = record.value.trim().toLowerCase();
    const existing = groups.get(normalized) ?? [];
    existing.push(record.sourceId);
    groups.set(normalized, existing);
  }

  const distinctValues = Array.from(groups.entries()).map(([value, sourceIds]) => ({
    value,
    sourceIds,
  }));

  return {
    status: distinctValues.length > 1 ? "CONFLICT" : "CONSISTENT",
    distinctValues,
    independentSourceCount: countIndependentSources(records),
  };
}
