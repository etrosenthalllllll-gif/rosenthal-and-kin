# Decision: Launch jurisdiction = California

**Status:** decided (reflects existing business, not a new choice)
**Date:** 2026-08-26

## Decision
California is the one launch state, per `17 - Build Order`'s
instruction to scope the jurisdiction rules engine, claim prep, and
filing connector to a single state before genericizing.

## Why
Not a new choice — the business already runs this way:
- The live marketing site (rosenthalandkin.com) discloses CCP §1582
  (California's heir-finder/probate-referee fee-cap and disclosure
  statute).
- The existing sourcing pipeline (`ca-heir-finder` skill) runs against
  the California State Controller's unclaimed-property database.

Recording it here just makes explicit what was already implicit, so
`02 - Legal/Compliance Rules Engine` (Phase 2) has a concrete state to
build the fee-cap/disclosure/UPL rule table against.

## Consequence
- `docs/decisions/` fee-cap/disclosure rule table (Phase 2, P2-1) is
  built for California only.
- Attorney review (blocked task P2-3, see `named-approver.md`) should be
  scoped to a CA-licensed probate/estate attorney or someone who has
  operated a licensed CA heir-search/finder's-fee business.
- Expanding to a second state is explicitly out of scope until CA works
  end-to-end (per doc 17's own build-order philosophy).
