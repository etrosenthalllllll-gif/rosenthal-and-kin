# Decision: Named legal approver

**Status: RESOLVED (owner-approved) — 2026-08-25.**

## What's needed

Per `03 - Legal, Trust & Governance Architecture` section 4.1 and
`17 - Build Order` task P7-1: a claim package cannot move
`Claim Ready -> Approved -> Filed` without sign-off from a specific,
named, credentialed individual — not a role, not "system," not a
confidence score. This must be a real person who takes legal
accountability, either:
- Ethan Rosenthal personally (if not requiring a licensed attorney for
  this claim type/jurisdiction), or
- A CA-licensed probate/estate attorney engaged for review and sign-off.

## Resolution

**Named approver: Ethan Rosenthal**, business owner, non-attorney.

Ethan explicitly requested this on 2026-08-25, overriding the
"leave blocked for human review" default this file previously carried
(the same session also overrode P2-1's attorney-review recommendation
for the compliance rule table — see PLAN.md). This is a real business
and legal risk he is choosing to accept for his own venture, made with
his eyes open to what it means: he is the accountable signer on every
claim's approval, personally, not an attorney certifying legal
sufficiency.

## Real limit this doesn't remove

Naming Ethan as the general approver does **not** override
`Cal. Bus. & Prof. Code §§ 6125/6126` (see
`app/src/lib/complianceRules.ts`): practicing law without an active
State Bar license is a misdemeanor, not just a business-risk tradeoff.
For any specific claim/jurisdiction/court where a licensed attorney's
signature or appearance is actually legally required to file (doc 03
§1.2, "Attorney-of-Record / Licensed-Professional Gating" — not yet
built), that requirement stands regardless of who the named approver
is. Ethan approving a claim package is not the same thing as an
attorney appearing where one is required, and the system must not
conflate the two once §1.2's gating logic exists. Until that logic is
built, this is a manual judgment call Ethan needs to make per claim.

## What ships now

The permission check, segregation-of-duties enforcement (preparer ≠
approver unless explicitly configured), immutable snapshot at sign-off,
and auto-invalidation-on-change logic (doc 03 §4.2-4.3) are Phase 7
work, not yet built. This resolution only unblocks the *policy*
question (who signs); the actual enforcement code is still todo — see
PLAN.md P2-3.
