# Decision: Sheets pipeline stays; backend bridges to it

**Status:** decided
**Date:** 2026-08-26

## Decision
The existing lead-sourcing → research → scoring → outreach automation
(Claude skills + scheduled tasks operating on the `heir-finder-tracker`
Google Sheet) is NOT rebuilt. The new backend (Core Infrastructure, per
`01 - Core Infrastructure`) ingests it as a data source: a sync/import
step turns a qualified tracker row into an `Estate` + `Claimant` record.

## Why
Every module spec in the System Architecture folder explicitly says
"DO NOT rebuild these systems" about the existing acquisition workflow.
That workflow works today. Rebuilding it would violate the spec and
waste the working automation already in place.

## Consequence
Phase 0 needs an import/sync job (tracker row -> Estate/Claimant) as
part of the Core Infrastructure build, not a lead-sourcing rewrite.
Exact sync mechanism (one-way import via Sheets API, or a manual
"promote to backend" action from the operator dashboard) is an
implementation detail decided during Phase 0/1, not a blocking decision.
