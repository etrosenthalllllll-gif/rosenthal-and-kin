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
