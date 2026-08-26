# Rosenthal & Kin — Build Plan

Adapted from the "17 - Build Order" spec doc (Google Drive: System
Architecture folder) plus the decisions in `docs/decisions/`. This file
is the single source of truth for build progress — read it first, update
it before finishing any session.

## Ground rules

1. Pick the first `todo` task in the current phase whose dependencies
   are `done`. Don't start a later phase while an earlier one has
   `todo`/`blocked` tasks, unless marked parallel-safe.
2. Implement it, write/run tests, don't mark done until tests pass.
3. Commit referencing the task ID.
4. Update this file: `done`, or `blocked: <reason>`.
5. **Never mark done on your own judgment**: anything touching money
   movement/trust ledger, the compliance rules engine, the legal
   sign-off gate, or filing/court submission. Implement + test, leave
   blocked for human review.
6. Credential/account needed but missing → `blocked: needs credential —
   <what>`, move to next unblocked task.

Status legend: `todo` · `in_progress` · `blocked` · `done`

## Phase 0 — Foundation
- [x] P0-DECIDE — funds-flow, launch jurisdiction, hosting/stack decisions recorded in `docs/decisions/`.
- [x] P0-2 done — Estate/Claimant/Person/Document/Decision/AuditEvent Prisma schema (`app/prisma/schema.prisma`). Pushed to the real Render Postgres via `npx prisma db push` (not `migrate dev` — Render's free-tier DB user isn't SUPERUSER, which `migrate dev`'s shadow-database step requires; `db push` needs no shadow DB). Verified for real: listed tables via `information_schema`, then did an actual create/count/delete round-trip against `rosenthal-and-kin-db`, not just a schema sync.
- [x] P0-4 done — Claimant lifecycle state machine (`app/src/lib/stateMachine.ts`), 8 passing tests. Enforces doc 00's forward path + universal REJECTED/WITHDRAWN/ESCALATED exits + terminal-state protection.
- [x] P0-6 partial/done — Password hashing (bcrypt) + role-based permission checks (`app/src/lib/auth.ts`), 8 passing tests, fail-closed by default. Session/login flow itself (the actual auth *endpoint*) not yet built — this is the permission-check primitive it will call.
- [x] P0-1 done — Next.js 14.2.35 (patched — 14.2.5 had known CVEs, bumped before committing) app scaffolded under `app/src/app`. Verified with a real `next build` (compiles, 0 errors) and `next start`, then hit `/` and `/api/health` with curl and got real responses back — not just "it compiled."
- [x] P0-3 done — `app/src/lib/caseNumber.ts`: case-number formatting (`RK-<n>`) + duplicate-estate detection (normalized-name+jurisdiction match, with same-probate-case-number as a stronger override for typo'd names). 14 passing tests, including accent-folding (José/Jose) and punctuation-stripping cases.
- [x] P0-5 done — `app/src/lib/audit.ts`: the AuditEvent *writer*, dependency-injected against a minimal DB interface (so it's unit-testable without a live Postgres), fails closed on missing required fields before ever calling the DB. 5 passing tests. Not yet wired into every mutation site — there are no other mutation sites yet (P1+ work) — but the primitive every future one will call is done and tested.
- [ ] P0-7 todo — Document storage abstraction (S3-compatible, signed URLs) — needs an object-storage account. Not part of Render Postgres/web service; still open.
- [ ] P0-8 todo — Background job queue (BullMQ) with idempotency keys — needs Redis. Render offers a Key Value (Redis-compatible) instance; not yet provisioned.
- [x] P0-9 done — `app/src/lib/providers/types.ts`: CommunicationProvider/DocumentStorageProvider/AIProvider/FilingProvider/PaymentProvider interfaces, no vendor code. Plus `inMemoryEmailProvider.ts`, a reference implementation used only in tests, which demonstrates the idempotent-send contract every real provider must honor (4 passing tests).
- [x] P0-10 done — Render account created (Ethan), then provisioned by me: `rosenthal-and-kin-db` (Postgres, Free tier, Ohio region) and `rosenthal-and-kin-app` (Web Service, Free tier, same region, root dir `app/`, connected to this repo via GitHub OAuth — Render already had repo access from account signup, so no separate authorization flow was needed). Schema pushed and verified live (see P0-2). App deployed and verified publicly reachable at `https://rosenthal-and-kin-app.onrender.com` — real `curl` round-trips against `/` (200) and `/api/health` (200, real JSON). Auto-deploy on push to `main` is enabled.
  - **Real constraint, not hypothetical:** the free Postgres instance **expires and is deleted on September 24, 2026** unless upgraded to a paid plan first. This is a hard deadline, not a someday concern — revisit before then. Free web service also spins down after inactivity (~50s cold-start delay on first request after idle).
- [ ] P0-11 todo — Sheets-tracker → Estate/Claimant import job (per `docs/decisions/sheets-integration.md`).

**Known accepted risk:** `npm audit` flags a transitive `postcss` vuln (XSS in CSS stringify output, sourcemap path traversal) bundled inside Next.js 14.2.35 — the only fix is Next 16, a breaking major version. These require an attacker controlling CSS input or sourceMappingURL comments, which doesn't apply to our own authored CSS. Accepted for now; revisit before a real production deploy or when upgrading Next for other reasons.

## Phase 1 — Decision & Operator Dashboard (`ops.*`)
- [x] P1-1 done (logic layer) — `app/src/lib/decisionTypes.ts`: configurable decision-type registry (8 types from doc 02 section 3 — APPROVE_OUTREACH, REQUEST_DOCUMENTS, APPROVE_CLAIMANT, RESOLVE_GENEALOGY_CONFLICT, APPROVE_CLAIM_PACKAGE, REVIEW_FILING_REJECTION, APPROVE_RECOVERY_DISTRIBUTION, CLOSE_CASE), each with its available actions and high-consequence flag. `app/src/lib/decisionStatus.ts`: the Decision status state machine (PENDING/IN_PROGRESS/APPROVED/REJECTED/REVISED/ESCALATED/DEFERRED/EXPIRED/CANCELLED/COMPLETED), same no-arbitrary-transitions discipline as the claimant machine. 15 passing tests between the two. The actual queue *UI* (decision cards, filters, real-time updates) is still todo — needs P0-1's app shell extended with real pages, reasonable to build once there's real data to show (P0-10).
- [x] P1-2 done — `app/src/lib/decisionWorkflow.ts`: `applyDecisionAction()` validates an action against the decision type's registry, enforces required comments, and checks the resulting status transition — all before anything is persisted. `applyApproveClaimantDecision()` is a concrete example wiring a decision outcome to the claimant lifecycle machine (APPROVE -> claimant advances POTENTIAL_HEIR -> VERIFIED; REJECT/ESCALATE leave the claimant's state untouched). 12 passing tests, including one proving it refuses to "verify" a claimant already past that point in their lifecycle (FILED, say) via a stray approval.
- [x] P1-3 done (scoring engine) — `app/src/lib/priority.ts`: configurable priority scoring (log-scaled recovery value, deadline proximity, decision age, risk level, inverse AI confidence, a high-consequence floor bump), bucketed into LOW/MEDIUM/HIGH/URGENT, plus `rankByPriority()` for sorting a queue. 10 passing tests. Case-summary generator and exception queue (the AI-narrative and conflict-surfacing pieces of doc 02) are still todo — reasonable to build alongside real AI-provider wiring rather than against fakes.

## Phase 2 — Legal/Compliance Rules Engine (California only)
- [ ] P2-1 todo — CA fee-cap/disclosure/UPL-boundary rule table (versioned, sourced).
- [ ] P2-2 todo — Engagement/fee agreement generator reading P2-1.
- [ ] P2-3 blocked: needs attorney review — see `docs/decisions/named-approver.md`.

## Phases 3-9 — Communications, Documents, Verification, Claim Prep, Filing, Post-filing, Recovery
Not started. See the full spec docs (Drive: System Architecture folder,
docs 04-10) for detail — summarized in the chat plan already delivered.

## Deferred
- Trust ledger (Phase 9 sub-component) — only if a case forces pass-through, per `docs/decisions/funds-flow-model.md`.
- Scale/triage, batch decisions, multi-operator — only when real volume forces it.
- Reconciling docs 14/15/16 (optimization-layer specs) into one — before Phase 10, not before.

## Session log
- 2026-08-26 — Repo inspected (was GitHub Pages marketing site only, no backend). Decisions recorded (funds-flow, jurisdiction, hosting/stack, sheets-integration). Named-approver left blocked. PLAN.md created. No Phase 0 code written yet — next session starts P0-1.
- 2026-08-26 — [P0-2, P0-4, P0-6] Prisma schema (Estate/Claimant/Person/Document/Decision/AuditEvent/Note), claimant state machine, and auth/permission primitives implemented under `app/`, all with passing tests (16/16, `npx vitest run`) and a validated Prisma schema (`npx prisma validate`). Portable Node.js v20.16.0 installed locally (machine had none; winget MSI install hung on a UAC prompt, switched to the no-admin-required zip distribution). Still open: Next.js itself isn't scaffolded yet (P0-1), so nothing is servable as a web app yet — next session should scaffold the app shell and wire these lib modules into real API routes, then tackle P0-3/P0-5.
- 2026-08-26 — [P0-1, P0-3, P0-5] Scaffolded the actual Next.js app (bumped to 14.2.35 for CVE fixes before committing), added case-number formatting + duplicate-estate detection, and the AuditEvent writer. Full suite: 35/35 tests passing. Ran a real `next build` (0 errors) and `next start`, then curled `/` and `/api/health` against the running server to confirm it actually serves, not just compiles. Next unblocked task is P0-9 (provider interfaces, no vendor calls) — everything else left in Phase 0 needs either the Render account (P0-10) or is a to-be-scheduled follow-up.
- 2026-08-26 — [P0-9] Provider abstraction interfaces (Communication/DocumentStorage/AI/Filing/Payment) plus an in-memory reference CommunicationProvider used only in tests, to lock in the idempotent-send contract every real vendor integration must satisfy. Full suite: 39/39 passing, `next build` still clean. Every non-blocked, credential-free Phase 0 task is now done — remaining Phase 0 items (P0-7, P0-8, P0-10, P0-11) all need either the Render account or Sheets API access. Next real coding session should start Phase 1 (Decision & Operator Dashboard) using in-memory/fake data until P0-10 unblocks a real DB, or wait for the Render account first — Ethan's call.
- 2026-08-26 — [P1-1, P1-2, P1-3] Built the Phase 1 *logic layer* against fake/in-memory data since P0-10 (Render account) is still blocked: decision-type registry, decision status state machine, the decision<->claimant wiring (with a concrete APPROVE_CLAIMANT example), and the priority-scoring engine. Full suite: 76/76 passing, `next build` still clean. Still todo for Phase 1: the actual dashboard UI/pages, the case-summary generator, and the exception queue -- all reasonable to defer until either P0-10 unblocks real data or an AIProvider is wired up. Asked Ethan whether to keep building fake-data logic or pause for the Render account.
- 2026-08-26 — [P0-10] Ethan created the Render account. Provisioned `rosenthal-and-kin-db` (free Postgres) and `rosenthal-and-kin-app` (free Web Service, connected to this GitHub repo, auto-deploy on). Pushed the schema with `prisma db push` (worked around a shadow-DB SUPERUSER permission error from `migrate dev` on Render's free tier). Verified with a real create/count/delete against the live DB, then verified the deployed app publicly over HTTPS. **Flagging the free DB's Sept 24, 2026 expiration as a real constraint to plan around, not a footnote.** P0-7 and P0-8 remain open (need object storage and Redis respectively, neither provisioned yet).
