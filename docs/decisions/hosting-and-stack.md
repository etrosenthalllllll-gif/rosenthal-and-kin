# Decision: Hosting and tech stack

**Status:** decided by Claude, per user delegation (2026-08-26)

## Hosting: Render
Chosen over Railway (usage-based billing, less predictable at low
volume) and Fly.io (more ops overhead than this project needs yet).
Flat tiers ($7/mo app, $6/mo Postgres to start), deploys from this
GitHub repo on push, per `20 - Hosting & Deployment Architecture`.

- `rosenthalandkin.com` (root) stays on GitHub Pages — unchanged.
- `portal.rosenthalandkin.com` and `ops.rosenthalandkin.com` will be
  new subdomains pointed at the Render deployment once Phase 0/1 exist
  to serve them. Not created yet — nothing to point them at.

## Live infrastructure (provisioned 2026-08-26, see PLAN.md P0-10)

- **Database:** `rosenthal-and-kin-db` — Render Postgres, Free tier,
  Ohio (US East) region. **Expires and is deleted September 24, 2026**
  unless upgraded to a paid plan before then — this is a real deadline
  that needs a decision (upgrade, or migrate/re-provision), not
  something to let lapse silently.
- **App:** `rosenthal-and-kin-app` — Render Web Service, Free tier,
  same region (private-network-eligible with the DB), connected to
  this GitHub repo with auto-deploy on push to `main`. Root directory
  `app/`. Build: `npm install && npx prisma generate && npm run build`.
  Start: `npm start`. Live at
  `https://rosenthal-and-kin-app.onrender.com`. Free tier spins down
  after inactivity (~50s cold-start on the next request).
- Schema is synced via `npx prisma db push`, not `prisma migrate dev` —
  Render's free-tier Postgres user lacks the SUPERUSER privilege
  `migrate dev`'s shadow-database step needs. This means there's no
  migration history yet, just a schema in sync with the DB. Move to
  `migrate deploy` with real migration files once that matters (before
  a second environment, or before this matters for rollback safety).

## Tech stack: Next.js + TypeScript + Prisma + Postgres
No existing application code to match (the repo was GitHub Pages only
— see `README.md`), so this is a new choice, not an inference:

- **Next.js (TypeScript)** — one codebase serves both the `ops.*`
  operator dashboard and `portal.*` claimant portal, plus API routes
  for the backend. Deploys cleanly to Render.
- **Prisma + Postgres** — schema-as-code migrations, type-safe queries,
  good fit for the Estate/Claimant/Case/Document/Decision/AuditEvent
  relational model in `01 - Core Infrastructure`.
- **BullMQ + Redis** — background job queue (OCR, communications,
  filing, monitoring polling) per doc 01 Phase 10.

## Consequence
Phase 0 build starts from an empty Next.js project in this repo, not
from an existing codebase inspection (there is nothing to inspect).
