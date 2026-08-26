# Decision: Named legal approver

**Status: BLOCKED — policy decision, cannot be made by Claude.**

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

## Why this stays blocked
This is exactly the category doc 17 itself flags: "Do not mark tasks
touching ... the legal sign-off gate ... as done on your own judgment
... leave them blocked for human review." Fabricating a placeholder
name here would defeat the entire point of the gate.

## What ships anyway
The permission check, the segregation-of-duties enforcement (preparer
≠ approver unless explicitly configured), the immutable snapshot at
sign-off, and the auto-invalidation-on-change logic (doc 03 §4.2-4.3)
all get built in Phase 7. They simply have no valid named approver
configured yet — which correctly blocks any case from reaching `Filed`
until this file is updated with a real name.

## To unblock
Update this file with the approver's full name and (if applicable)
attorney bar number/license, then remove the BLOCKED status above.
