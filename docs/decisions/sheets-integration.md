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

## Which sheet, exactly (resolved 2026-08-26)
Confirmed by searching Drive: the live tracker is titled exactly
`heir-finder-tracker` —
https://docs.google.com/spreadsheets/d/1LOwYvct2bISgeZjPbUIk6EaWsYpAbU4qrMB8zQopo88/edit
(most recently modified of all candidates). Every other similarly-named
sheet found in Drive is explicitly marked `SUPERSEDED` or
`ARCHIVED-DO-NOT-USE` in its title, so this wasn't ambiguous once
actually searched for -- no user input needed to resolve it.
