// Sheets tracker -> Estate/Claimant import -- PLAN.md P0-11,
// docs/decisions/sheets-integration.md. "A sync/import step turns a
// qualified tracker row into an Estate + Claimant record" -- this module
// is that step.
//
// Scope, deliberately narrow for v1: one heir per row (the first named
// candidate), no Relationship graph yet (that needs a Person record for
// the decedent, which nothing upstream produces today), and no
// contact/document status carried over structurally -- the full raw row
// is preserved in a Note so nothing is silently lost, even though it
// isn't modeled yet. Expand as later phases need more of the row.
//
// Split the same way every other DB-touching module in this codebase is:
// pure decision logic here (fully unit-tested with fixtures), a thin
// Prisma-touching wrapper that isn't (src/lib/db.ts pattern).

import { formatCaseNumber, findDuplicateEstates, type EstateDuplicateCandidate } from "./caseNumber";

// --- Raw row shape (matches the heir-finder-tracker header row) -----------

export interface TrackerRow {
  lead_id: string;
  decedent_name: string;
  county?: string;
  reported_amount?: string;
  score?: string;
  score_band?: string;
  candidate_heir_name?: string;
  heir_relationship?: string;
  status?: string;
  [key: string]: string | undefined; // every other column, preserved as-is
}

export type ImportOutcome =
  | { kind: "CREATE"; estate: EstateInput; person: PersonInput; claimant: ClaimantInput; note: string }
  | { kind: "SKIPPED"; leadId: string; reason: string }
  | { kind: "DUPLICATE"; leadId: string; matchesEstateIds: string[] };

export interface EstateInput {
  caseNumber: string;
  decedentName: string;
  jurisdiction: string;
  estimatedValueCents: number | null;
  sourceTrackerRowId: string;
}

export interface PersonInput {
  firstName: string;
  lastName: string;
}

export interface ClaimantInput {
  status: "LEAD";
  priorityScore: number;
}

/**
 * Parses a dollar-amount string like "389256.69" or "$389,256.69" into
 * integer cents. Returns null (not 0) when the input is missing or not a
 * parseable number -- 0 would falsely claim a known zero-dollar estate.
 */
export function parseMoneyToCents(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

/**
 * Extracts the first named heir from a `candidate_heir_name` cell, which
 * in practice looks like "Tamar Simon Hoffs (wife); Susanna Hoffs
 * (daughter); ..." -- takes everything before the first "(" or ";", then
 * splits on whitespace treating the last token as the last name. Crude,
 * but every real tracker example seen so far parses correctly; multi-word
 * last names (double-barrelled, "de la Cruz") are a known limitation to
 * revisit once real data exposes it.
 *
 * Requires every word to look capitalized-name-shaped (starts with an
 * uppercase letter) -- found via a real production import that this cell
 * isn't always a name at all. One row's value was the literal placeholder
 * "none found yet - survivors not accessible via web search", which
 * split into first/last name tokens just fine and would have silently
 * created a fake claimant named "Search" if this guard didn't exist.
 */
export function parseFirstHeirName(raw: string | undefined | null): PersonInput | null {
  if (!raw) return null;
  const firstEntry = raw.split(/[(;]/)[0].trim();
  if (!firstEntry) return null;

  const parts = firstEntry.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null; // need at least a first and last name
  // Allow an optional leading quote character, since real cells include
  // nicknames like `Tamar "Tammy" Simon Hoffs`.
  if (!parts.every((word) => /^["']?[A-Z]/.test(word))) return null; // not name-shaped

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

/**
 * Maps a raw score_band string to a priority-score seed (0-100 scale,
 * consistent with src/lib/priority.ts's labels) so an imported claimant
 * starts somewhere sane in the queue rather than always at 0. This is a
 * seed, not a replacement for computePriorityScore -- the queue re-derives
 * the real score from deadline/value/etc. once those fields exist.
 */
function seedPriorityFromScoreBand(scoreBand: string | undefined): number {
  switch (scoreBand?.trim()) {
    case "Drop everything":
      return 80;
    case "Strong":
      return 50;
    default:
      return 20;
  }
}

/**
 * Pure decision function: given one tracker row and the set of estates
 * already in the DB (for duplicate detection) plus the set of lead_ids
 * already imported (for idempotency), decides what to do with the row.
 * Never mutates anything -- the DB-touching wrapper acts on the result.
 */
export function planImportForRow(
  row: TrackerRow,
  existingEstates: EstateDuplicateCandidate[],
  alreadyImportedLeadIds: ReadonlySet<string>,
  nextCaseSequence: number
): ImportOutcome {
  if (!row.lead_id?.trim()) {
    return { kind: "SKIPPED", leadId: row.lead_id ?? "(missing)", reason: "missing lead_id" };
  }

  if (alreadyImportedLeadIds.has(row.lead_id)) {
    return { kind: "SKIPPED", leadId: row.lead_id, reason: "already imported" };
  }

  if (!row.decedent_name?.trim()) {
    return { kind: "SKIPPED", leadId: row.lead_id, reason: "missing decedent_name" };
  }

  const heir = parseFirstHeirName(row.candidate_heir_name);
  if (!heir) {
    return { kind: "SKIPPED", leadId: row.lead_id, reason: "no parseable candidate heir name" };
  }

  const candidate: EstateDuplicateCandidate = {
    id: `pending-${row.lead_id}`,
    decedentName: row.decedent_name,
    jurisdiction: "CA",
  };
  const duplicates = findDuplicateEstates(existingEstates, candidate);
  if (duplicates.length > 0) {
    return { kind: "DUPLICATE", leadId: row.lead_id, matchesEstateIds: duplicates.map((d) => d.id) };
  }

  return {
    kind: "CREATE",
    estate: {
      caseNumber: formatCaseNumber(nextCaseSequence),
      decedentName: row.decedent_name.trim(),
      jurisdiction: "CA",
      estimatedValueCents: parseMoneyToCents(row.reported_amount),
      sourceTrackerRowId: row.lead_id,
    },
    person: heir,
    claimant: {
      status: "LEAD",
      priorityScore: seedPriorityFromScoreBand(row.score_band),
    },
    note: JSON.stringify(row),
  };
}
