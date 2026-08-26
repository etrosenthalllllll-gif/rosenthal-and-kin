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
- [x] P0-2 done — Estate/Claimant/Person/Document/Decision/AuditEvent Prisma schema (`app/prisma/schema.prisma`), validated with `npx prisma validate`. Not yet migrated against a real DB (no Postgres instance exists — see P0-10).
- [x] P0-4 done — Claimant lifecycle state machine (`app/src/lib/stateMachine.ts`), 8 passing tests. Enforces doc 00's forward path + universal REJECTED/WITHDRAWN/ESCALATED exits + terminal-state protection.
- [x] P0-6 partial/done — Password hashing (bcrypt) + role-based permission checks (`app/src/lib/auth.ts`), 8 passing tests, fail-closed by default. Session/login flow itself (the actual auth *endpoint*) not yet built — this is the permission-check primitive it will call.
- [x] P0-1 done — Next.js 14.2.35 (patched — 14.2.5 had known CVEs, bumped before committing) app scaffolded under `app/src/app`. Verified with a real `next build` (compiles, 0 errors) and `next start`, then hit `/` and `/api/health` with curl and got real responses back — not just "it compiled."
- [x] P0-3 done — `app/src/lib/caseNumber.ts`: case-number formatting (`RK-<n>`) + duplicate-estate detection (normalized-name+jurisdiction match, with same-probate-case-number as a stronger override for typo'd names). 14 passing tests, including accent-folding (José/Jose) and punctuation-stripping cases.
- [x] P0-5 done — `app/src/lib/audit.ts`: the AuditEvent *writer*, dependency-injected against a minimal DB interface (so it's unit-testable without a live Postgres), fails closed on missing required fields before ever calling the DB. 5 passing tests. Not yet wired into every mutation site — there are no other mutation sites yet (P1+ work) — but the primitive every future one will call is done and tested.
- [ ] P0-7 todo — Document storage abstraction (S3-compatible, signed URLs) — needs an object-storage account (blocked on P0-10-style credential).
- [ ] P0-8 todo — Background job queue (BullMQ) with idempotency keys — needs Redis (blocked on hosting).
- [x] P0-9 done — `app/src/lib/providers/types.ts`: CommunicationProvider/DocumentStorageProvider/AIProvider/FilingProvider/PaymentProvider interfaces, no vendor code. Plus `inMemoryEmailProvider.ts`, a reference implementation used only in tests, which demonstrates the idempotent-send contract every real provider must honor (4 passing tests).
- [ ] P0-10 blocked: needs credential — Render account + Postgres + object storage provisioned. Needs Ethan to create the Render account; I can configure once it exists. Nothing in P0-2/P0-7/P0-8 can run against real infrastructure until this unblocks.
- [ ] P0-11 todo — Sheets-tracker → Estate/Claimant import job (per `docs/decisions/sheets-integration.md`).

**Known accepted risk:** `npm audit` flags a transitive `postcss` vuln (XSS in CSS stringify output, sourcemap path traversal) bundled inside Next.js 14.2.35 — the only fix is Next 16, a breaking major version. These require an attacker controlling CSS input or sourceMappingURL comments, which doesn't apply to our own authored CSS. Accepted for now; revisit before a real production deploy or when upgrading Next for other reasons.

## Phase 1 — Decision & Operator Dashboard (`ops.*`)
- [ ] P1-1 todo — Decision queue + card data model.
- [ ] P1-2 todo — Approve/Reject/Revise/Escalate wired to the state machine.
- [ ] P1-3 todo — Priority scoring, case summary generator, exception queue.

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
