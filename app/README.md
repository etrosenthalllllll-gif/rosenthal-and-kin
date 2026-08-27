# Rosenthal & Kin — application

Backend + operator dashboard + claimant portal, per `../PLAN.md` and the
architecture docs (Google Drive: System Architecture folder). Next.js not
yet scaffolded (`npm install` hasn't been run for the framework itself) —
what exists so far is the foundation layer, verified with real tests:

- `prisma/schema.prisma` — Estate/Claimant/Person/Document/Decision/
  AuditEvent data model. Validated with `npx prisma validate`.
- `src/lib/stateMachine.ts` — claimant lifecycle transitions (doc 00).
  8 passing tests.
- `src/lib/auth.ts` — password hashing (bcrypt) + role-based permission
  checks, enforced server-side. 8 passing tests.

## Setup
```
npm install
cp .env.example .env   # then fill in a real DATABASE_URL
npx prisma generate
npm test
```

No Postgres instance exists yet (Render account not yet created — see
`../docs/decisions/hosting-and-stack.md` and PLAN.md task P0-10).
