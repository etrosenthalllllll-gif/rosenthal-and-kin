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
- [x] P0-6 done — Password hashing (bcrypt) + role-based permission checks (`app/src/lib/auth.ts`), 8 passing tests, fail-closed by default. **Session/login flow now built** (was the open half of this task): `app/src/lib/session.ts` (pure token generation/hashing/expiry, 8 passing tests), `app/src/lib/sessionStore.ts` (DB-touching wrapper: `authenticateUser`/`createSession`/`getUserBySessionToken`/`deleteSession`, untested by design like every other DB wrapper here), `app/src/lib/requireSession.ts` (Server Component gate — redirects to `/login` if no valid session cookie). Routes: `POST /api/auth/login` (form POST, sets an httpOnly/secure/sameSite=lax cookie on success), `POST /api/auth/logout` (deletes the session row + clears the cookie). `app/src/app/login/page.tsx`: plain HTML form, no client JS needed. `/ops` now calls `requireSession()` and shows the signed-in user + a sign-out button — the auth gap flagged in that file's own comments since P1-4 is closed. `Session` model added to the Prisma schema and pushed to the live Render Postgres (additive-only, user confirmed before running against production). No self-registration endpoint exists by design (internal tool, not a public product) — `app/scripts/create-user.mjs` (`npm run create:user`) is the only way to create an account, matching `import:tracker`'s manual-invocation pattern. Created the first real ADMIN account (`ethan@rosenthalandkin.com`) against the live DB. **Verified for real, not just deployed:** clicked through the actual flow on the live production URL — `/ops` redirects to `/login` when signed out, signing in lands back on the real `rosenthal-and-kin-app.onrender.com/ops` domain (not a bug -- see below), the page shows the signed-in user and a working sign-out control, and signing out redirects back to `/login` on the real domain. Repeated the login a second time to confirm it wasn't a fluke. **Still open:** per-role authorization (`requirePermission()`) isn't wired into any action yet — there's nothing to gate beyond page-level read access until Phase 1+ adds real actions; a "forgot password"/self-service reset flow doesn't exist either (only-known workaround today is another `create:user` run, or a direct DB update).
  - **Real bug found by that verification, fixed immediately:** the first deploy of this feature redirected a successful login to `https://localhost:10000/ops` instead of the public URL. Cause: `NextResponse.redirect(new URL(path, req.url))` trusts the request's own perceived origin, which behind Render's reverse proxy is the internal bind address, not the public host -- invisible in local dev (no proxy in front), only surfaced once tested against the live deploy. Fixed with `app/src/lib/requestOrigin.ts` (`getPublicOrigin()`), which prefers `X-Forwarded-Host`/`X-Forwarded-Proto` and falls back to `req.nextUrl.origin`; used in both auth routes, 3 new tests. This is exactly the kind of bug a clean `next build` and passing test suite cannot catch -- only clicking through the real flow on the real deployment did.
- [x] P0-1 done — Next.js 14.2.35 (patched — 14.2.5 had known CVEs, bumped before committing) app scaffolded under `app/src/app`. Verified with a real `next build` (compiles, 0 errors) and `next start`, then hit `/` and `/api/health` with curl and got real responses back — not just "it compiled."
- [x] P0-3 done — `app/src/lib/caseNumber.ts`: case-number formatting (`RK-<n>`) + duplicate-estate detection (normalized-name+jurisdiction match, with same-probate-case-number as a stronger override for typo'd names). 14 passing tests, including accent-folding (José/Jose) and punctuation-stripping cases.
- [x] P0-5 done — `app/src/lib/audit.ts`: the AuditEvent *writer*, dependency-injected against a minimal DB interface (so it's unit-testable without a live Postgres), fails closed on missing required fields before ever calling the DB. 5 passing tests. Not yet wired into every mutation site — there are no other mutation sites yet (P1+ work) — but the primitive every future one will call is done and tested.
- [x] P0-7 done — Ethan created a Cloudflare account and enabled R2; I created the `rosenthal-and-kin-documents` bucket (Standard storage, not publicly accessible) and an Account API token scoped to just that bucket with Object Read & Write. `app/src/lib/providers/r2DocumentStorageProvider.ts`: real `DocumentStorageProvider` implementation using the AWS S3 SDK against R2's S3-compatible endpoint (`region: "auto"`, per R2's docs). `createR2ProviderFromEnv()` reads `R2_ENDPOINT`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME` and fails fast listing every missing var by name — 3 passing tests for that validation logic. Credentials added to Render's env vars directly (never displayed in chat, copied via clipboard the same way GitHub PATs are handled). **Honest gap:** a live put/get/delete round-trip against the real bucket was attempted but the verification script's env vars didn't survive across separate shell tool calls (shell state doesn't persist between calls, only cwd does) — rather than re-expose the secret a third time to retry, I stopped and am flagging this as not yet round-trip-verified, not claiming it works when I haven't confirmed it end-to-end. Will verify for real the first time an actual upload code path exists (Phase 5, document intake).
- [x] P0-8 done — Provisioned `rosenthal-and-kin-redis` (Render Key Value, Free tier, Ohio, `noeviction` maxmemory policy — the default "allkeys-lru" would silently drop queued jobs under memory pressure, wrong for a job queue even though it's the right call for a cache). Internal URL wired into the web service as `REDIS_URL`. `app/src/lib/queue/types.ts`: `JobQueueProvider` interface with a required `idempotencyKey` per enqueue, same discipline as the Communication provider. `app/src/lib/queue/bullMqJobQueue.ts`: real BullMQ-backed implementation, using the idempotencyKey as the BullMQ job ID and checking `getJob()` first so a retried enqueue reports `DUPLICATE` instead of silently no-op'ing. `app/src/lib/queue/inMemoryJobQueue.ts`: reference implementation for tests, 4 passing tests proving the idempotency contract. Not yet wired into any real workflow (no workers exist yet — that's Phase 4+ when outreach/filing jobs get built), but the primitive and its Redis backing are both real and live.
- [x] P0-9 done — `app/src/lib/providers/types.ts`: CommunicationProvider/DocumentStorageProvider/AIProvider/FilingProvider/PaymentProvider interfaces, no vendor code. Plus `inMemoryEmailProvider.ts`, a reference implementation used only in tests, which demonstrates the idempotent-send contract every real provider must honor (4 passing tests).
- [x] P0-10 done — Render account created (Ethan), then provisioned by me: `rosenthal-and-kin-db` (Postgres, Free tier, Ohio region) and `rosenthal-and-kin-app` (Web Service, Free tier, same region, root dir `app/`, connected to this repo via GitHub OAuth — Render already had repo access from account signup, so no separate authorization flow was needed). Schema pushed and verified live (see P0-2). App deployed and verified publicly reachable at `https://rosenthal-and-kin-app.onrender.com` — real `curl` round-trips against `/` (200) and `/api/health` (200, real JSON).
  - **Real constraint, not hypothetical:** the free Postgres instance **expires and is deleted on September 24, 2026** unless upgraded to a paid plan first. This is a hard deadline, not a someday concern — revisit before then. Free web service also spins down after inactivity (~50s cold-start delay on first request after idle).
  - **Resolved (was flagged as a known issue, wasn't actually a bug):** `622f66b` and `c4452e8` didn't auto-deploy because both only touched `PLAN.md`/`docs/` at the repo root — the service's Root Directory is `app/`, and Render's own docs state "code changes outside of this directory do not trigger an auto-deploy." Confirmed via `git show --stat` that neither commit touched anything under `app/`. Verified the GitHub App (Render) is installed with "All repositories" access and read/write repo-hooks permission, so it's not a credential/scope problem either — auto-deploy should fire normally for any push that touches `app/`. No action needed; just remember doc-only commits need a Manual Deploy if you want them live sooner (rare, since they don't affect the running app). **Confirmed for real:** the `8b770a7` push (P0-8, touches `app/`) auto-deployed with no manual trigger — Render's dashboard shows `TRIGGER: Auto-Deploy` — and `curl https://rosenthal-and-kin-app.onrender.com/api/health` returned a real 200 afterward. Not just theoretically fixed.
- [x] P0-11 done — Ethan created a Google Cloud project (`rosenthal-and-kin`) and I did the rest: enabled the Sheets API, created a service account (`rosenthal-and-kin-sheets-impor@rosenthal-and-kin.iam.gserviceaccount.com`, read-only intent, no project-level IAM role needed), generated its JSON key, shared the `heir-finder-tracker` sheet with it (Viewer), and wired `GOOGLE_SHEETS_CLIENT_EMAIL`/`GOOGLE_SHEETS_PRIVATE_KEY`/`GOOGLE_SHEETS_TRACKER_SPREADSHEET_ID` into Render's env vars. Deleted the local JSON key file once its two fields were extracted -- it isn't kept anywhere as a file.
  - `app/src/lib/trackerImport.ts`: pure decision logic (`planImportForRow`) mapping one raw tracker row to CREATE/SKIPPED/DUPLICATE, built against the tracker's real column names and real example rows (Hoffs, Terras) as test fixtures. Scope is deliberately narrow for v1: **one heir per row** (the first named candidate — real rows list several, e.g. "Tamar Simon Hoffs (wife); Susanna Hoffs (daughter); ..."), and **no Relationship graph yet** (needs a Person record for the decedent, which nothing upstream produces). The full raw row is preserved in a Note so nothing is silently lost. 16 passing tests covering money parsing, heir-name parsing (incl. a regression test for the real placeholder-text bug below), idempotency (skip already-imported lead_ids), and duplicate-estate detection (reuses `findDuplicateEstates` from P0-3).
  - `app/src/lib/sheetsClient.ts`: real Sheets API client (JWT service-account auth via googleapis' own bundled auth client -- installing `google-auth-library` standalone alongside `googleapis` caused a duplicate-package type conflict, removed it). Auto-detects the spreadsheet's actual first tab name rather than assuming "Sheet1".
  - `app/src/lib/runTrackerImport.ts`: wires the pure logic to live Prisma + live Sheets, creates a placeholder `system-tracker-import` User row (Note.authorId is a required FK and there's no real "system" actor yet — P0-6's login endpoint isn't wired up), records an AuditEvent per created Estate.
  - `app/scripts/run-tracker-import.mjs` (`npm run import:tracker`): manual invocation, matching the decision doc's "manual promote" option rather than a schedule — a cron/BullMQ wiring is a small follow-up once someone wants it unattended.
  - **Gap closed — ran the real import.** Retrieved the private key back out of Render's own env-var store (no new key generated) for one clean run, then cleared it again. `npm run import:tracker` against the live `heir-finder-tracker` sheet and live DB: **24 Estates + Claimants created, 37 correctly skipped, 0 false duplicates.** Verified directly against Postgres afterward (real case numbers RK-1..RK-24, real decedent names, real dollar values, real heir names).
  - **Real bug found via real data, fixed:** one row's `candidate_heir_name` cell was the literal placeholder text "none found yet - survivors not accessible via web search" (a case where no heir has been researched yet), and `parseFirstHeirName` happily split it into a fake person ("...Search"), creating a bogus claimant on RK-22 (Karen R Rogers). Added a name-shape guard (every token must start with an optional quote + uppercase letter) with a regression test using this exact string, and manually deleted the one bad Person/Claimant it had already created (the Estate itself was correct and kept). This is exactly the kind of bug that only real data — not fixtures I write myself — surfaces; the whole reason the "actually run it" step mattered.
  - `/ops`'s empty-state copy was stale after this ("no cases have been imported yet") — fixed to reflect reality: cases are imported, there's just no Decision-creation workflow yet (Phase 4+).

**Known accepted risk:** `npm audit` flags a transitive `postcss` vuln (XSS in CSS stringify output, sourcemap path traversal) bundled inside Next.js 14.2.35 — the only fix is Next 16, a breaking major version. These require an attacker controlling CSS input or sourceMappingURL comments, which doesn't apply to our own authored CSS. Accepted for now; revisit before a real production deploy or when upgrading Next for other reasons.

**Fixed in passing (P0-8 session):** adding bullmq/ioredis surfaced a critical `vitest` RCE advisory (GHSA-5xrq-8626-4rwp, arbitrary file read/execute when Vitest's UI/API server is listening) that predated this session — 2.0.5 was already in the vulnerable range, it just hadn't shown up in `npm audit` until the dependency tree re-resolved. Bumped `vitest` 2.0.5 → 3.2.7 (patched), reran the full suite (80/80 passing) and `next build` (clean) to confirm nothing broke.

## Phase 1 — Decision & Operator Dashboard (`ops.*`)
- [x] P1-1 done (logic layer) — `app/src/lib/decisionTypes.ts`: configurable decision-type registry (8 types from doc 02 section 3 — APPROVE_OUTREACH, REQUEST_DOCUMENTS, APPROVE_CLAIMANT, RESOLVE_GENEALOGY_CONFLICT, APPROVE_CLAIM_PACKAGE, REVIEW_FILING_REJECTION, APPROVE_RECOVERY_DISTRIBUTION, CLOSE_CASE), each with its available actions and high-consequence flag. `app/src/lib/decisionStatus.ts`: the Decision status state machine (PENDING/IN_PROGRESS/APPROVED/REJECTED/REVISED/ESCALATED/DEFERRED/EXPIRED/CANCELLED/COMPLETED), same no-arbitrary-transitions discipline as the claimant machine. 15 passing tests between the two. The actual queue *UI* (decision cards, filters, real-time updates) is still todo — needs P0-1's app shell extended with real pages, reasonable to build once there's real data to show (P0-10).
- [x] P1-2 done — `app/src/lib/decisionWorkflow.ts`: `applyDecisionAction()` validates an action against the decision type's registry, enforces required comments, and checks the resulting status transition — all before anything is persisted. `applyApproveClaimantDecision()` is a concrete example wiring a decision outcome to the claimant lifecycle machine (APPROVE -> claimant advances POTENTIAL_HEIR -> VERIFIED; REJECT/ESCALATE leave the claimant's state untouched). 12 passing tests, including one proving it refuses to "verify" a claimant already past that point in their lifecycle (FILED, say) via a stray approval.
- [x] P1-3 done (scoring engine) — `app/src/lib/priority.ts`: configurable priority scoring (log-scaled recovery value, deadline proximity, decision age, risk level, inverse AI confidence, a high-consequence floor bump), bucketed into LOW/MEDIUM/HIGH/URGENT, plus `rankByPriority()` for sorting a queue. 10 passing tests.
  - **Exception queue closed** — `app/src/lib/exceptionQueue.ts`: doc 02 section 12. Deliberately not a new DB entity: exceptions are Decisions whose type is flagged `category: "EXCEPTION"` in `decisionTypes.ts` (5 new types added — `RESOLVE_LOW_CONFIDENCE`, `RESOLVE_CONFLICTING_EVIDENCE`, `RESOLVE_DUPLICATE_CASE`, `RESOLVE_INVALID_DOCUMENT`, `RESOLVE_WORKFLOW_FAILURE`, covering doc 02's trigger list without one type per bullet), reusing the same Decision/DecisionStatus machinery already built rather than a competing model. `splitQueueByLane()`/`buildExceptionQueue()` split an already-ranked queue into lanes without re-ranking. Wired into `/ops`: exceptions now render in their own red-flagged section above the routine queue. 6 new tests (16 total across decisionTypes.ts + exceptionQueue.ts). Doc 02's "OVERRIDE where authorized" action is deliberately omitted from `availableActions` — it needs its own permission grant beyond the existing role checks that doesn't exist yet; noted in the module's comments rather than faked.
  - **Case-summary generator closed** — `app/src/lib/caseSummary.ts`: `generateCaseSummary()`, deterministic template-based synthesis (decedent/claimant/status → known facts → missing documents → competing heirs → estimated recovery → AI recommendation, in doc 02 section 9's priority order), not an LLM call since no `AIProvider` is wired yet (that's Phase 3+) — the `CaseSummaryInput` contract is designed so a real AI-backed version can replace the function body later without changing callers. 11 passing tests. **Not yet wired into `/ops`'s UI**, unlike the exception queue: doing so honestly needs real per-case document-received/required counts and competing-heir counts, and neither the Document intake path (Phase 5) nor the Relationship graph (needs a decedent Person record, per `trackerImport.ts`'s existing scope note) produces that data yet. Wiring it against placeholder/fake data would violate this session's own "verify for real" discipline, so it's built and tested but deliberately not yet rendered — same reasoning P1-1/P1-2/P1-3 originally gave for deferring UI wiring until real data existed.
- [x] P1-4 done (queue UI, real data) — `app/src/lib/db.ts`: Prisma client singleton (stashed on `globalThis` in dev to avoid connection-pool exhaustion on hot reload). `app/src/lib/decisionQueue.ts`: `buildDecisionQueue()` (pure, joins Decision+Claimant+Person+Estate rows into ranked view models, 5 passing tests) and `fetchDecisionQueue()` (thin Prisma wrapper, untested by design — same split as audit.ts). `app/src/app/ops/page.tsx`: a real server-rendered decision queue page reading PENDING decisions from the live Postgres DB, sorted by priority, split into an Exceptions lane and a Decisions lane (see P1-3 above). **Verified for real, not just compiled:** seeded one throwaway Decision/Claimant/Estate/Person into the live DB, ran the page locally against the live `DATABASE_URL`, confirmed via curl that it rendered the seeded case correctly (name, case number, priority score/label) — then deleted the test rows and the seed/cleanup scripts. **Gap closed (see P0-6 above):** `/ops` now requires a real login session via `requireSession()`.

## Phase 2 — Legal/Compliance Rules Engine (California only)
- [x] P2-1 done — **Owner-approved override, 2026-08-25:** Ethan explicitly overrode the ground rules' "leave blocked for human/attorney review" default for the compliance rules engine and approved this module himself, then asked for the underlying law to actually be checked properly rather than left as an open question. That second research pass resolved the open question for real (see below), so this is now backed by verified statutory research, not just an owner sign-off on an unresolved gap — but it is still not attorney-reviewed, and nothing here should be represented as legal advice.
  - `app/src/lib/complianceRules.ts`: versioned/sourced `ComplianceRule` table, `isRuleStale()` (12-month staleness check per doc 03 §1.5), `checkFeeCompliance()` (now asset-source-aware — see below), `scanForLegalAdviceLanguage()` (pattern-based first pass at doc 03 §1.1's outbound-text UPL scanner). 18 passing tests.
  - **Real, verified findings from a second research pass:** every citation checked directly against `leginfo.legislature.ca.gov`. `Cal. Bus. & Prof. Code §§ 6125/6126` (UPL prohibition + misdemeanor penalty). `Cal. Prob. Code § 11604` (court may refuse/reshape distribution to a heir-locator if the fee is "grossly unreasonable" — confirmed as a case-by-case court-review standard, not a fixed cap; CA has never codified a percentage cap for probate-estate heir-locator fees, period). `Cal. Prob. Code § 11604.5` (the actual heir-locator-specific disclosure regime for probate estates: written agreement, filed with the court within 30 days and 15+ days before the final-distribution hearing, 10-point-type fee disclosure, no agency/recourse clauses — this is what P2-2's agreement generator needs to read from). **`Cal. Code Civ. Proc. § 1582`: a real, verified, fixed 10% fee cap** — but it only applies to agreements to recover property already reported to the CA State Controller as *unclaimed property*, not to active probate estates. The widely-repeated "10% heir-finder cap" claim (falsely attributed by multiple law-firm-blog sources to `Cal. Prob. Code § 11004`, whose real text is about personal-representative expense reimbursement) turned out to be a real number pointing at the wrong statute — the actual CCP § 1582 was found by continuing to dig rather than stopping at the first dead end.
  - `checkFeeCompliance()` is now asset-source-aware (`PROBATE_ESTATE` vs `STATE_CONTROLLER_UNCLAIMED_PROPERTY`, since this business's normal case is the former per `Estate.probateCaseNumber`): it enforces the real 10% cap numerically for unclaimed-property cases, and fails closed (`BLOCK_AND_ESCALATE`) for probate-estate cases — not as a placeholder pending research, but because CA law itself hands that determination to a court's case-by-case judgment, which an automated check correctly can't substitute for.
  - Full suite: 152/152 passing, `next build` clean.
- [x] P2-2 done — `app/src/lib/engagementAgreement.ts`: `generateEngagementAgreement()` reads exclusively from `complianceRules.ts` (single source of truth, per doc 03 §1.4 — "not separate hardcoded percentages in two modules"). Drafts agreement text whenever a verified disclosure/fee-cap rule exists for the jurisdiction/asset source, records exactly which rule versions backed the draft (`rulesUsed`, each with its citation and `lastReviewedDate` — doc 03 §1.4's "must record which version of the rule set was used, since these statutes change"), and separately reports `canAdvanceToEngaged` (true only when `checkFeeCompliance()` returns `PROCEED`). Key design call: the agreement *text* still gets drafted for CA probate estates even though the fee can never auto-clear (Prob. Code § 11604 is a court's case-by-case call, not a number) — doc 03 blocks the claimant from advancing to "Engaged," not the existence of a document for a human to review. Explicitly does not invent a rescission/cooling-off right — neither verified statute (Prob. Code § 11604.5, CCP § 1582) contains one, so the draft says so plainly rather than assume a "standard" cancellation clause exists. 8 passing tests. Same owner-approved-override status as P2-1: implemented and tested, not attorney-reviewed — the draft text says so in its own footer.
- [x] P2-3 done — Named-approver policy question resolved; see `docs/decisions/named-approver.md` (Ethan named as approver, owner override, 2026-08-25). The actual enforcement code (permission check, segregation-of-duties, immutable snapshot, auto-invalidation) is Phase 7 work and still todo — this only unblocked the policy decision, not the implementation.

## Phase 3 — Communications (doc 04)
Read doc 04 ("Communications") in full from Drive (48 sections) before
decomposing. Reuses existing groundwork rather than rebuilding it:
`CommunicationProvider` (channel-unified, `app/src/lib/providers/types.ts`)
already satisfies doc 04 §32's provider-abstraction requirement across
EMAIL/SMS/VOICE/MAIL — no separate `EmailProvider`/`SMSProvider` types
needed. `Claimant` is the "case" this doc refers to (per-claimant-per-estate
pursuit, matching Decision's own `claimantId` keying); `Person` is the
participant. Real vendor accounts (Twilio, Postmark/SendGrid inbound
parsing, PostGrid, a voice/telephony provider) don't exist yet, so every
task below that needs a live account is `blocked: needs credential`
rather than self-approved — only the provider-agnostic logic (data model,
matching, classification config, rules engine, opt-out enforcement,
idempotency, follow-up scheduling) is buildable now.

- [x] P3-1 done — Unified `Communication` + `Conversation` Prisma models
  (doc 04 §1-2): `CommunicationChannel`/`CommunicationDirection`/
  `CommunicationDeliveryStatus` enums, `ConversationAttentionStatus`
  (AUTOMATED/OPERATOR_REQUIRED/EXCEPTION, doc 04 §27) plus a separate
  `humanHandling` boolean (§30 — independent of *why* attention is
  needed). Both models key off `claimantId` (case) AND `personId`
  (participant) independently per §2's "don't assume one case = one
  person/conversation." `Communication.providerMessageId` and
  `.idempotencyKey` are both unique DB constraints — the real
  enforcement mechanism behind doc 04 §34's "this is critical," not just
  application-level convention. Also added centralized per-`Person`
  communication preferences (`emailAllowed`/`smsAllowed`/`voiceAllowed`/
  `mailAllowed`/`doNotContact`, doc 04 §19) since they're pure schema
  and the natural home is on the model this task already touches — the
  *enforcement* logic is still P3-6. Pushed to the live Render Postgres
  via `prisma db push` (same shadow-DB workaround as P0-2). Built
  `communicationTimeline.ts`: `buildCommunicationTimeline()` (pure —
  chronological view-model builder per doc 04 §24's timeline example,
  derives `requiresAttention` from the conversation's attention status
  rather than duplicating it per-message, falls back to a truncated body
  when no AI summary exists yet) + `fetchCommunicationTimeline()` (thin
  Prisma wrapper, untested by design, same split as `decisionQueue.ts`).
  7 new tests, full suite 167/167, `next build` clean.
- [x] P3-2 done — Conversation-to-case matching engine (doc 04 §3):
  `matchConversationToCase.ts` — pure, confidence-scored function over
  the signals doc 04 lists (provider thread ID, explicit case-number
  reference in text, email, phone, name), weighted so the strongest
  signals (thread continuation, case-number reference) dominate over the
  weakest (name alone, which can't clear even the ambiguous floor by
  itself — common names collide). Three outcomes: `AUTO_ATTACH` (one
  candidate clears 0.9 confidence AND clearly leads the runner-up by a
  margin — two candidates both clearing the threshold is treated as
  ambiguous, not a coin-flip auto-attach, matching doc 04's own "Cases
  RK-1842 and RK-1917" example exactly), `AMBIGUOUS`, or `NO_MATCH`.
  Never guesses, per the doc's explicit instruction. Added
  `RESOLVE_AMBIGUOUS_CASE_MATCH` to `decisionTypes.ts`'s EXCEPTION set
  (reuses the existing Decision/exception-queue machinery from
  P1-3/exceptionQueue.ts rather than a new model) with a `CREATE_NEW_CASE`
  action alongside `RESOLVE`/`ESCALATE`/`DEFER`, since "none of these
  matches" is a named, common outcome in doc 04's own example, not just
  a variant of picking one. 13 new tests, full suite 180/180, `next
  build` clean. Wiring this into the real inbound pipeline (calling it
  with live Prisma candidate rows, actually creating the Decision row)
  is P3-3.
- [x] P3-3 done — Inbound email ingestion pipeline, minus the live inbox
  connection (doc 04 §4-5): `planInboundEmailIngestion.ts` —
  `planInboundEmailIngestion(email, context)` validates the payload,
  checks idempotency against already-seen provider message IDs (the
  real enforcement is `Communication.providerMessageId`'s DB unique
  constraint from P3-1; this is the decision layer in front of it),
  then calls P3-2's matcher using the email's `In-Reply-To` header as
  the thread signal and subject+body as the case-number-reference
  signal. Four outcomes: `REJECT_INVALID`, `SKIP_DUPLICATE`,
  `ATTACH_TO_CASE` (auto-match), `CREATE_MATCH_EXCEPTION` (ambiguous —
  or genuinely no match at all, which this pipeline deliberately treats
  the same way rather than silently dropping the message, per doc 04
  §44's "never silently disappear"). The original message body is
  carried through completely untouched into the communication draft, no
  AI transformation applied (§4: "do not rely only on an
  AI-transformed version" — there's no AI step in this pipeline yet
  regardless, see P3-4). The actual webhook endpoint that would receive
  real provider payloads is still
  `blocked: needs credential — inbound email provider account (e.g.
  Postmark/SendGrid inbound parse) not yet provisioned`; this decision
  logic has no such dependency and is fully tested against synthetic
  payloads. 8 new tests, full suite 189/189, `next build` clean. Depends
  on P3-1, P3-2.
- [x] P3-4 done — Communication classification engine (doc 04 §6, §9,
  §28): `communicationClassification.ts` — `CLASSIFICATION_CATEGORIES`,
  a full configurable table covering every category doc 04 §6 lists
  (INTERESTED through ESCALATE, 20 total), each with its own confidence
  threshold (§28: "configurable by communication type... not these exact
  numbers") and an `alwaysRequiresHumanReview` flag for the categories
  §7/§9 name explicitly (LEGAL_QUESTION, PAYMENT_QUESTION, SUSPICIOUS,
  DECEASED_PERSON, UNCLEAR, ESCALATE — no confidence clears these, matching
  §9's own worked example: "IF classification = LEGAL_QUESTION THEN: Do
  not automatically answer"). `routeClassifiedCommunication()` fails
  closed to `HUMAN_REVIEW` on an unrecognized category, same discipline
  as `checkFeeCompliance()`'s "no matching rule → block." Does **not**
  call a real AI model — no live `AIProvider` account exists yet
  (`blocked: needs credential — Anthropic API key not provisioned`,
  same gap `caseSummary.ts` flagged in Phase 1); this is the
  configuration-and-routing layer that runs on a classification result
  from any source, tested against synthetic results that exercise the
  exact same logic a real model's output would. 9 new tests, full suite
  199/199, `next build` clean. Depends on P3-1.
- [x] P3-5 done — Communications automation rule engine (doc 04 §9, §29,
  §30): `communicationAutomationRules.ts` — `decideAutomationAction()`
  composes the three engines already built this phase rather than
  re-deriving any of their logic (the doc's own point: this module is
  "the evaluator," not a new source of truth for any one signal):
  P3-4's `routeClassifiedCommunication()` for classification/confidence,
  P3-6's `canSendOnChannel()` for opt-out enforcement, and §30's
  `humanHandling` flag. Fixed precedence: (1) a human already owns the
  conversation → `DO_NOTHING`, automation stays out of the way entirely;
  (2) the message itself is an opt-out signal (`DO_NOT_CONTACT`/
  `UNSUBSCRIBE`) → `STOP_COMMUNICATIONS`, honoring it *is* the automated
  action, no human decision needed to process a stop request; (3)
  classifier requires human review → `CREATE_DECISION`; (4) classifier
  would allow automation but the person is opted out on this channel →
  `ESCALATE` rather than silently doing nothing or sending anyway (§44:
  "never silently disappear") — this contradiction is exactly the kind
  of case that needs a human's attention; (5) otherwise →
  `RESPOND_AUTOMATICALLY`. 10 new tests, full suite 217/217, `next
  build` clean. Depends on P3-2 (already used inside the earlier
  pipeline stages), P3-4, P3-6.
- [x] P3-6 done — Communication preferences / opt-out / do-not-contact
  (doc 04 §19): `communicationPreferences.ts` — `canSendOnChannel()` is
  the single check every outbound path should call before sending;
  centralized `doNotContact` always wins over per-channel flags,
  matching §19's explicit "do not rely solely on the individual channel
  system." `applyOptOutSignal()` is the pure state transition for the
  two distinct signals §19 calls out: `DO_NOT_CONTACT` (centralized,
  channel-independent — the channel it arrived on doesn't matter) vs.
  `UNSUBSCRIBE` (touches only the one channel it arrived on, per §19's
  own SMS-opt-out example — "while potentially allowing permitted other
  channels"). Both signal keys map directly onto P3-4's
  `DO_NOT_CONTACT`/`UNSUBSCRIBE` classification categories, so the
  classifier's output feeds straight into this function. Reads/writes
  the `Person` preference fields already added to the schema in P3-1. 9
  new tests, full suite 207/207, `next build` clean. Depends on P3-1.
- [x] P3-7 done — Follow-up sequence scheduler (doc 04 §21); outbound
  idempotency itself (§34-35) turned out to need no new code — it's
  already enforced by `JobQueueProvider.enqueue()`'s required
  `idempotencyKey` (P0-8) and `Communication.idempotencyKey`'s DB unique
  constraint (P3-1); documented this explicitly in
  `followUpScheduler.ts`'s header rather than duplicate that logic.
  `planNextFollowUp()` — pure scheduling decision over a configurable
  day-offset sequence (`DEFAULT_OUTREACH_SEQUENCE`: Day 0/7/14/30, doc
  04's own example, verbatim) → `STOP` | `SEQUENCE_COMPLETE` | `WAIT` |
  `SEND`. All seven of §21's named stop conditions
  (hasResponded/hasOptedOut/caseClosed/personInactive/operatorPaused/
  workflowChanged/anotherChannelTookOver) checked before scheduling
  logic runs, each with its own reason string — "do not blindly send
  follow-ups after meaningful responses" enforced as the first check,
  not an afterthought. Global emergency pause-all-outbound (§36) and
  rate limits/cooldowns (§35) are cross-cutting concerns for the actual
  send path (not the sequence-scheduling decision this task scoped) —
  left for whichever task wires a real outbound send loop to a live
  provider, since building that control now with nothing to control
  would be premature. 9 new tests, full suite 226/226, `next build`
  clean. Depends on P3-1, P3-6 (used for opt-out state feeding
  `hasOptedOut`, not called directly here).
- [ ] P3-8 todo — Human handoff / takeover (doc 04 §10, §30-31): escalation
  triggers (low confidence, dispute, legal question, hostility, ambiguous
  match, repeated automation failure), `HUMAN_HANDLING` pause-then-resume,
  and the SEND/REVISE/REJECT/ESCALATE decision shape for AI-drafted
  responses (never overwrite the original draft — store
  draft+revision+final separately, §8). Depends on P3-4, P3-5.
- [ ] P3-9 todo — SMS integration (doc 04 §11-12): same pipeline as P3-3
  but for SMS, against `CommunicationProvider`. Live send/receive is
  `blocked: needs credential — SMS provider (e.g. Twilio) account not yet
  provisioned`; the channel-agnostic pipeline logic itself is not
  blocked. Depends on P3-1 through P3-6.
- [ ] P3-10 todo — Voice/phone architecture + AI phone agent state machine
  (doc 04 §13-17): `VoiceProvider` interface (doc 04 already anticipates
  this fits inside `CommunicationProvider`'s channel abstraction) and the
  explicit call-state machine (§15) bounding what the AI agent may do in
  each state. Live calls/transcription are
  `blocked: needs credential — voice/telephony provider account not yet
  provisioned`; the state machine and transcript-processing logic are not
  blocked. Depends on P3-1, P3-4.
- [ ] P3-11 todo — Physical mail integration (doc 04 §23): PostGrid
  provider adapter satisfying `CommunicationProvider`.
  `blocked: needs credential — PostGrid API key (test/sandbox) not yet
  provisioned`.
- [ ] P3-12 todo — Communication history timeline + search UI in the case
  workspace (doc 04 §24-25, §45): unified chronological view across all
  channels, filterable. Depends on P3-1 (data exists to render).
- [ ] P3-13 todo — Communication dashboard + analytics (doc 04 §26, §41):
  metrics (pending responses, exceptions, opt-outs, follow-ups due,
  automated vs. human-reviewed rate) linking into the existing `/ops`
  decision dashboard rather than a separate surface. Depends on P3-1
  through P3-8.

## Phases 4-9 — Documents, Verification, Claim Prep, Filing, Post-filing, Recovery
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
- 2026-08-26 — Investigated the "auto-deploy didn't fire" issue flagged above: not a bug. Root Directory is `app/`, and Render explicitly skips auto-deploy for commits that don't touch it; both flagged commits were doc-only changes at the repo root. Confirmed via `git show --stat` and by checking the Render GitHub App's installation settings (All repositories, read/write repo-hooks permission) — access/webhook scope is fine. Closed out the note in P0-10 above.
- 2026-08-26 — [P0-7, P1-4] Resolved which Sheets tracker is canonical (searched Drive: `heir-finder-tracker`, every other candidate explicitly marked SUPERSEDED/ARCHIVED-DO-NOT-USE — no user input needed once actually searched for). Ethan created a Cloudflare account and started R2 setup; I finished it (bucket, scoped API token) and wired the credentials into Render. Built the real R2 document storage provider and the first real dashboard page (`/ops`, decision queue) against the live Postgres DB, verified with a real seed/render/cleanup round-trip. Full suite: 88/88 passing, `next build` clean. Remaining blocked: P0-11 (Sheets API service account — link sent to Ethan, not yet created).
- 2026-08-26 — [P0-8] Provisioned `rosenthal-and-kin-redis` (Render Key Value, Free, Ohio), corrected its maxmemory policy from the UI's cache-oriented default (`allkeys-lru`) to `noeviction` since job data must not be evicted under memory pressure. Wired the internal URL into the app as `REDIS_URL`. Built `JobQueueProvider` (interface + BullMQ-backed impl + in-memory test impl), all idempotency-keyed like the Communication provider. Full suite: 80/80 passing, `next build` clean. In passing, fixed a critical vitest RCE advisory that predated this session (2.0.5 → 3.2.7). Remaining Phase 0 items: P0-7 (object storage, needs an external account) and P0-11 (Sheets import, needs Sheets API access) — both still credential-blocked.
- 2026-08-26 — [P0-11] Ethan created the Google Cloud project; I enabled the Sheets API, created and keyed the service account, shared the tracker sheet with it, and wired credentials into Render. Built `trackerImport.ts` (pure row->Estate/Claimant decision logic, tests against real tracker column names/data), `sheetsClient.ts` (real Sheets API client), and `runTrackerImport.ts` (DB wiring, `npm run import:tracker`). `next build` clean (after fixing a duplicate-package type conflict between `googleapis` and a standalone `google-auth-library` install). P0-7 and P0-11 were the last two open Phase 0 items -- both closed this session. **Phase 0 is complete.**
- 2026-08-26 — Actually ran the tracker import for real (retrieved the private key back out of Render's own store for one clean run, not a new key) against the live sheet and live DB: 24 Estates+Claimants created, 37 correctly skipped, 0 false duplicates -- verified directly in Postgres. Found and fixed a real bug this surfaced: a placeholder-text cell ("none found yet - survivors...") was getting parsed as a fake heir name; added a name-shape guard + regression test, manually deleted the one bad Person/Claimant it created (kept the real Estate). Fixed `/ops`'s now-stale empty-state copy. Full suite: 104/104 passing.
- 2026-08-25 — [P0-6] Closed the auth gap `/ops` had been flagging in its own comments since P1-4: built the session/login half of P0-6 (token generation+hashing+expiry in `session.ts`, DB wrapper in `sessionStore.ts`, `requireSession()` Server Component gate, `/api/auth/login` + `/api/auth/logout` routes, a plain-HTML `/login` page). Added a `Session` model to the Prisma schema and pushed it to the live Render Postgres (additive-only; confirmed with Ethan before running against production, since this got auto-blocked as a live-DB-mutation action). `/ops` now requires a real session and shows a sign-out control. No self-registration endpoint exists by design — added `npm run create:user` (matches `import:tracker`'s manual-invocation pattern) and used it to create the first real ADMIN account (`ethan@rosenthalandkin.com`). Full suite: 112/112 passing, `next build` clean. Still open: per-role authorization isn't wired into any action yet (nothing to gate until Phase 1+ adds real mutating actions), and there's no self-service password reset.
- 2026-08-25 — Verified the P0-6 login flow for real on the live deploy (not just "tests pass, build is clean") and found a real bug it would have been easy to ship: signing in redirected to `https://localhost:10000/ops` instead of the public URL, because `new URL(path, req.url)` trusts the request's own perceived origin, which behind Render's proxy is the internal bind address. Fixed with `app/src/lib/requestOrigin.ts` (prefers `X-Forwarded-Host`/`X-Forwarded-Proto`), 3 new tests, full suite 115/115 passing. Re-verified the complete cycle twice on the real production URL: signed-out `/ops` → `/login`, sign-in → real `/ops` domain with signed-in user + sign-out control, sign-out → real `/login` domain. Both GitHub pushes for this used the standard single-use-PAT flow (generated, used, revoked each time).
- 2026-08-25 — [P2-1] Started Phase 2 (all of Phase 0 and the auth half of Phase 1 done). Read doc 03 ("Legal, Trust & Governance Architecture") in full from Drive to scope this correctly. Built `app/src/lib/complianceRules.ts`: a versioned/sourced compliance-rule table plus `isRuleStale()`, `checkFeeCompliance()` (fails closed when no verified cap rule exists), and `scanForLegalAdviceLanguage()` (UPL-boundary text scanner). Researched real CA citations via WebSearch/WebFetch, verifying every one directly against `leginfo.legislature.ca.gov` rather than trusting secondary sources — caught multiple law-firm-blog sites confidently citing the wrong Probate Code section (§ 11004) for a "10% heir-finder fee cap" that section's real text doesn't contain; left that specific claim out rather than encode an unverified fact, and documented the discrepancy in the rule's own notes field. 14 passing tests, full suite 129/129, `next build` clean. Per the ground rules (compliance rules engine = never self-approve) this is implemented and tested but left explicitly blocked for a real attorney's review, matching doc 03's own recommendation to have one review this exact section before it's relied on.
- 2026-08-25 — Phase 2 is now hard-blocked (P2-1 needs attorney review, P2-2 depends on it, P2-3 needs a named approver) and Phases 3-9 aren't decomposed into tasks yet, so rather than idle, went back and closed two pieces of Phase 1 that P1-3's own note had flagged as still-todo despite the checkbox being checked: doc 02's case-summary generator (section 9) and exception/review queue (section 12). Read doc 02 ("Decision and Operator System") in full from Drive to scope both correctly. Built `exceptionQueue.ts` (reuses the existing Decision/DecisionStatus machinery via a new `category: EXCEPTION` flag on 5 new decision types, rather than a competing model) and wired it into `/ops` as a real red-flagged section — verified via the full test suite and a clean build, not just written. Built `caseSummary.ts` (deterministic template synthesis, no AIProvider wired up yet) but deliberately did NOT wire it into `/ops`'s UI: doing so honestly needs real document-count and competing-heir data that nothing upstream produces yet, and faking that data to make the UI look finished would break this session's "verify for real" discipline. 17 new tests (11 case summary + 6 exception queue, plus 2 more decisionTypes tests for the new category field), full suite 149/149, `next build` clean.
- 2026-08-25 — Ethan explicitly overrode the "leave blocked for attorney review" defaults on both P2-1 and P2-3 and asked for real legal research rather than an unresolved gap. Did a second, deeper research pass on the CA fee-cap question: found `Cal. Prob. Code § 11604.5` (the actual probate-estate heir-locator disclosure statute -- filing deadlines, 10-point-type disclosure, no agency/recourse clauses) and `Cal. Code Civ. Proc. § 1582` (a REAL, verified, fixed 10% fee cap -- but scoped only to CA State Controller unclaimed-property recovery agreements, not probate estates). This explains the widely-repeated "10% heir-finder cap" claim: it's a real number, just attached to the wrong statute by multiple secondary sources. Rewrote `complianceRules.ts`'s `checkFeeCompliance()` to be asset-source-aware (`PROBATE_ESTATE` vs `STATE_CONTROLLER_UNCLAIMED_PROPERTY`) so it actually enforces the real 10% cap for unclaimed-property cases while correctly staying fail-closed for probate estates (CA hands that to case-by-case court judgment, confirmed, not an open question). Updated `docs/decisions/named-approver.md`: Ethan named as the approver (owner override), with an explicit note that this doesn't override the UPL licensing requirement for cases where a licensed attorney is actually required to file. P2-1 and P2-3 marked done in PLAN.md, both explicitly noted as owner-approved rather than attorney-reviewed. Full suite: 152/152 passing, `next build` clean.
- 2026-08-25 — [P2-2] Engagement/fee agreement generator (`engagementAgreement.ts`), now unblocked since P2-1 has real disclosure content to read from. Drafts agreement text from `complianceRules.ts`'s verified rules, records which rule versions backed each draft, and gates `canAdvanceToEngaged` on `checkFeeCompliance()` rather than duplicating that logic. Deliberately still drafts a document for CA probate estates even though the fee can never auto-clear (doc 03 blocks advancing the claimant, not producing something for a human to review), and deliberately does NOT invent a rescission right neither verified statute contains. 8 new tests, full suite 160/160 passing, `next build` clean. Same owner-approved-override status as P2-1.
- 2026-08-25 — Phase 2 fully done; started Phase 3 (Communications). Read doc 04 ("Communications," 48 sections) in full from Drive and decomposed it into P3-1 through P3-13 in PLAN.md, flagging every task that needs a real vendor account (SMS/voice/mail providers, live inbound-email webhook) as `blocked: needs credential` per the ground rules rather than self-approving around the gap — only the provider-agnostic logic is buildable right now. [P3-1] Built the unified `Communication`/`Conversation` Prisma model (doc 04 §1-2), reusing the existing channel-unified `CommunicationProvider` interface from `providers/types.ts` instead of inventing separate per-channel provider types (already satisfies doc 04 §32). Keyed to both `claimantId` and `personId` independently per §2's "don't assume 1:1." `providerMessageId`/`idempotencyKey` are unique DB constraints, the real backing for §34's idempotency requirement. Added centralized per-Person communication preferences (§19) as pure schema now, enforcement logic deferred to P3-6. Pushed to the live Render DB via `prisma db push`. Built `communicationTimeline.ts` (pure chronological view-model builder, doc 04 §24, + a thin Prisma fetch wrapper). 7 new tests, full suite 167/167 passing, `next build` clean.
- 2026-08-26 — [P3-2] `matchConversationToCase.ts`: pure, confidence-scored conversation-to-case matcher over doc 04 §3's signal list (thread ID, case-number reference, email, phone, name), weighted so no single weak signal (name alone) can cross even the ambiguous floor. Never guesses: two candidates both clearing the auto-attach threshold resolve to `AMBIGUOUS`, exactly matching doc 04's own "Cases RK-1842 and RK-1917" example rather than picking one arbitrarily. Added `RESOLVE_AMBIGUOUS_CASE_MATCH` to the EXCEPTION set in `decisionTypes.ts` (reuses P1-3's Decision/exception-queue machinery, no new model) with an explicit `CREATE_NEW_CASE` action. 13 new tests, full suite 180/180 passing, `next build` clean.
- 2026-08-26 — [P3-3] `planInboundEmailIngestion.ts`: pure inbound-email ingestion decision layer, sitting on top of P3-2's matcher. Validates the payload, dedupes on provider message ID (idempotency), matches via P3-2 using In-Reply-To as the thread signal, and produces one of REJECT_INVALID/SKIP_DUPLICATE/ATTACH_TO_CASE/CREATE_MATCH_EXCEPTION. Treats a genuine no-match the same as an ambiguous match (raise for human review) rather than silently dropping the message, per doc 04's "never silently disappear." The live webhook endpoint stays blocked (no inbound email provider account provisioned yet); this decision logic has no such dependency. 8 new tests, full suite 189/189 passing, `next build` clean.
- 2026-08-26 — [P3-4] `communicationClassification.ts`: configurable category table covering doc 04 section 6's full list (20 categories), per-category confidence thresholds (section 28), and an `alwaysRequiresHumanReview` flag for the categories section 7/9 name explicitly (legal questions, payment questions, suspicious messages, deceased-person reports, unclear/escalate) -- no confidence level clears these. `routeClassifiedCommunication()` fails closed to human review on an unrecognized category. No live AI model call yet (no AIProvider account provisioned -- same gap as caseSummary.ts); this is the config-and-routing layer, fully tested against synthetic classification results. 9 new tests, full suite 199/199 passing, `next build` clean.
- 2026-08-26 — [P3-6] `communicationPreferences.ts`: `canSendOnChannel()` (the single before-send check, centralized doNotContact always wins over per-channel flags) and `applyOptOutSignal()` (pure state transition -- DO_NOT_CONTACT is centralized/channel-independent, UNSUBSCRIBE only touches the one channel it arrived on, per doc 04's own SMS-opt-out example). Both signal keys map directly onto P3-4's DO_NOT_CONTACT/UNSUBSCRIBE classification categories. 9 new tests, full suite 207/207 passing, `next build` clean.
- 2026-08-26 — [P3-5] `communicationAutomationRules.ts`: `decideAutomationAction()` composes P3-4's classification routing, P3-6's opt-out enforcement, and doc 04 section 30's humanHandling flag into one fixed-precedence evaluator (human-owned conversation > opt-out signal processed as an automated stop > classifier-requires-human > classifier-allows-but-channel-blocked escalates rather than silently dropping or wrongly sending > otherwise respond automatically). No new business rule invented -- this module is the evaluator over signals the earlier P3 tasks already produce. 10 new tests, full suite 217/217 passing, `next build` clean.
- 2026-08-26 — [P3-7] `followUpScheduler.ts`: `planNextFollowUp()`, a pure decision over a configurable day-offset sequence (DEFAULT_OUTREACH_SEQUENCE: Day 0/7/14/30, doc 04's own example) and all seven of section 21's stop conditions, checked first so a mid-sequence response never triggers a blind follow-up. Outbound idempotency (sections 34-35) needed no new code -- already enforced by the job queue's required idempotencyKey (P0-8) and Communication.idempotencyKey's DB unique constraint (P3-1); documented rather than duplicated. Global pause-all-outbound and rate limiting deferred to whichever task wires a real send loop to a live provider. 9 new tests, full suite 226/226 passing, `next build` clean.
