# Decision: Funds-flow model = direct-pay (default)

**Status:** decided by Claude, per user delegation (2026-08-26) — revisit if a
specific county's process forces pass-through.

## Decision
Default every case to **direct-pay**: the county/estate pays the heir
directly; Rosenthal & Kin invoices its fee separately. Recovered funds
never touch a company-controlled account by default.

## Why (per `03 - Legal, Trust & Governance Architecture`, section 2)
- Direct-pay carries far lower regulatory burden: no trust-accounting/
  IOLTA-style obligations, no segregated ledger, no dual-approval
  disbursement workflow, no escheatment exposure on undisbursed funds.
- Pass-through is the more-demanding model the spec says to design for
  *if it occurs*, not to default into. Building the trust ledger
  (Phase 9 / doc 10) before it's needed is wasted, legally-exposed
  surface area for a business just launching.

## Consequence
- `docs/decisions/` (this file) is the system of record per case unless
  overridden.
- The data model still supports per-case funds-flow (per doc 03 §2.1) —
  this is a default, not a hardcoded assumption. A specific county or
  administrator process can force pass-through on an individual case;
  that case then requires the trust-ledger subsystem before it can close.
- Phase 9 (Recovery & Payment) build order: skip the trust sub-ledger
  entirely for MVP; add it only when a real case actually requires
  pass-through.

## Who can revisit this
Ethan Rosenthal, or an attorney engaged per `named-approver.md`. Not a
decision the system should silently change once real cases exist.
