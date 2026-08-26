// Identity verification / entity resolution -- doc 06 sections 3-5.
// PLAN.md P5-2.
//
// "Build an identity verification workflow. The system should
// determine whether multiple records refer to the same real-world
// person... The system should produce: LIKELY SAME PERSON / POSSIBLE
// MATCH / INSUFFICIENT EVIDENCE / LIKELY DIFFERENT PERSON. Never merge
// identities automatically when evidence is ambiguous." / "Use
// multiple signals. Do not make a decision solely from name
// similarity. Every identity match should show: MATCH SCORE and:
// MATCHING EVIDENCE."
//
// Same shape as matchConversationToCase.ts (P3-2) / matchDocumentToCase.ts
// (P4-4): pure, confidence-scored comparison, no DB access. What's
// different here is the subject -- two *identity records*, not a
// message/document against a case -- so this earns its own module
// rather than being forced into either existing matcher's signature.
//
// Fuzzy name comparison is intentionally simple (surname must match
// exactly, or match one of the other record's maiden/former names;
// first name allows an initial to stand in for a full given name) --
// doc 06 section 4's own examples (John Smith / John A Smith / John
// Albert Smith / J. A. Smith) are exactly this shape. It is NOT a
// general-purpose fuzzy-name library, and it deliberately does not
// guess at OCR-style spelling errors -- that needs real extraction
// confidence data (P4-9) this module doesn't have.

export interface IdentityRecord {
  fullName: string;
  // Other names this same record is also known by -- maiden name,
  // prior married names, etc. Checked against the OTHER record's
  // surname so a maiden-name change doesn't read as "different person."
  alternateNames?: readonly string[];
  dob?: string | null; // ISO date, e.g. "1981-01-02"
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface IdentityComparisonContext {
  // Evidence that directly and explicitly links the two records as the
  // same person -- doc 06 section 4's own example ("supported by a
  // marriage record and matching DOB"). This can't be derived from
  // string comparison; it comes from wherever a document or verified
  // relationship makes the link explicit.
  documentedLinks?: readonly string[];
}

export type IdentityMatchOutcome =
  | "LIKELY_SAME_PERSON"
  | "POSSIBLE_MATCH"
  | "INSUFFICIENT_EVIDENCE"
  | "LIKELY_DIFFERENT_PERSON";

export interface IdentityMatchResult {
  outcome: IdentityMatchOutcome;
  matchScore: number; // 0.0-1.0
  matchingEvidence: string[];
}

// Not hardcoded deep in the scoring logic -- same config-table
// discipline as MATCH_SIGNAL_WEIGHTS in matchConversationToCase.ts.
export const IDENTITY_SIGNAL_WEIGHTS = {
  name: 0.3,
  dob: 0.35,
  address: 0.1,
  phone: 0.1,
  email: 0.1,
  documentedLink: 0.5, // doc 06's own strongest signal
} as const;

export const LIKELY_SAME_PERSON_THRESHOLD = 0.85;
export const POSSIBLE_MATCH_THRESHOLD = 0.4;

function normalizeToken(token: string): string {
  return token.replace(/\.$/, "").toLowerCase();
}

function tokenizeName(name: string): string[] {
  return name
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

function isInitialMatch(a: string, b: string): boolean {
  if (a.length === 1 || b.length === 1) {
    return a[0] === b[0];
  }
  return a === b;
}

function surnameCandidates(record: IdentityRecord): string[] {
  const tokens = tokenizeName(record.fullName);
  const primary = tokens.length > 0 ? tokens[tokens.length - 1] : null;
  const alternates = (record.alternateNames ?? []).flatMap((name) => {
    const t = tokenizeName(name);
    return t.length > 0 ? [t[t.length - 1]] : [];
  });
  return [primary, ...alternates].filter((s): s is string => Boolean(s));
}

/**
 * Pure: doc 06 section 4's fuzzy name comparison. Returns 0 when
 * surnames don't match at all (including via alternate/maiden names on
 * either side) -- a name-only signal never carries a match on its own
 * regardless of first-name similarity, since a shared first name with
 * no surname link is exactly the "share a surname" false-positive risk
 * doc 06 section 23 warns about, just inverted.
 */
export function nameMatchScore(a: IdentityRecord, b: IdentityRecord): number {
  const tokensA = tokenizeName(a.fullName);
  const tokensB = tokenizeName(b.fullName);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const surnamesA = surnameCandidates(a);
  const surnamesB = surnameCandidates(b);
  const surnameMatches = surnamesA.some((sa) => surnamesB.includes(sa));
  if (!surnameMatches) return 0;

  const firstA = tokensA[0];
  const firstB = tokensB[0];
  const firstMatches = isInitialMatch(firstA, firstB);
  if (!firstMatches) return 0.3; // shared surname only -- weak alone

  const exact =
    tokensA.length === tokensB.length && tokensA.every((t, i) => t === tokensB[i]);
  return exact ? 1 : 0.8;
}

/**
 * Pure: doc 06 sections 3-5. Scores two identity records against each
 * other using multiple independent signals -- never a name-only
 * decision -- and classifies the result. Never resolves to a
 * definitive merge; POSSIBLE_MATCH always routes to human review
 * (that routing itself is P5-10's job, not this function's).
 */
export function resolveIdentityMatch(
  a: IdentityRecord,
  b: IdentityRecord,
  context: IdentityComparisonContext = {}
): IdentityMatchResult {
  let score = 0;
  const evidence: string[] = [];

  const nameScore = nameMatchScore(a, b);
  if (nameScore > 0) {
    score += IDENTITY_SIGNAL_WEIGHTS.name * nameScore;
    evidence.push(
      nameScore === 1
        ? "Full name matches exactly"
        : "Name matches (surname" + (nameScore < 0.5 ? " only" : ", first name/initial") + ")"
    );
  }

  const dobConflict = Boolean(a.dob && b.dob && a.dob !== b.dob);
  if (a.dob && b.dob && a.dob === b.dob) {
    score += IDENTITY_SIGNAL_WEIGHTS.dob;
    evidence.push("Date of birth matches");
  }

  if (a.address && b.address && a.address.trim().toLowerCase() === b.address.trim().toLowerCase()) {
    score += IDENTITY_SIGNAL_WEIGHTS.address;
    evidence.push("Address matches");
  }

  if (a.phone && b.phone && a.phone.replace(/\D/g, "") === b.phone.replace(/\D/g, "")) {
    score += IDENTITY_SIGNAL_WEIGHTS.phone;
    evidence.push("Phone matches");
  }

  if (a.email && b.email && a.email.trim().toLowerCase() === b.email.trim().toLowerCase()) {
    score += IDENTITY_SIGNAL_WEIGHTS.email;
    evidence.push("Email matches");
  }

  const documentedLinks = context.documentedLinks ?? [];
  if (documentedLinks.length > 0) {
    score += IDENTITY_SIGNAL_WEIGHTS.documentedLink;
    evidence.push(...documentedLinks);
  }

  const matchScore = Math.min(1, score);

  // A confirmed DOB mismatch is direct contradicting evidence -- doc 06
  // section 3's own "LIKELY DIFFERENT PERSON" outcome -- and outweighs
  // a weak name-only signal even if some other coincidental field lines
  // up.
  if (dobConflict && matchScore < POSSIBLE_MATCH_THRESHOLD) {
    return {
      outcome: "LIKELY_DIFFERENT_PERSON",
      matchScore,
      matchingEvidence: evidence,
    };
  }

  if (matchScore >= LIKELY_SAME_PERSON_THRESHOLD) {
    return { outcome: "LIKELY_SAME_PERSON", matchScore, matchingEvidence: evidence };
  }

  if (matchScore >= POSSIBLE_MATCH_THRESHOLD) {
    return { outcome: "POSSIBLE_MATCH", matchScore, matchingEvidence: evidence };
  }

  return { outcome: "INSUFFICIENT_EVIDENCE", matchScore, matchingEvidence: evidence };
}
