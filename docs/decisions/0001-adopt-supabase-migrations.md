# ADR-0001 — Adopt Supabase CLI migrations

**Status:** Accepted · 2026-08-07

## Context
All schema changes live as sequential `alter table ... add column if not exists` blocks
appended to a single hand-maintained `src/lib/supabase/schema.sql` (531 lines), applied by
pasting into the Supabase SQL editor. No versioning, no rollback, no drift detection, no
way to reset a development database.

The operations module adds roughly a dozen tables.

## Decision
Adopt the Supabase CLI migration system. Baseline the existing schema as
`supabase/migrations/0001_baseline.sql` unchanged. Every subsequent change is a new
numbered migration applied by tooling.

`schema.sql` is retired as a source of truth and deleted after baselining.

## Consequences
- Development databases become resettable and reproducible.
- Rollback becomes possible.
- Cost: one-time baselining, and the discipline that no schema change may be hand-applied.

## Alternatives rejected
- **Continue appending.** Retrofitting later requires reverse-engineering a baseline from
  production, which gets harder every week.
- **Adopt an ORM (Prisma/Drizzle) for migrations.** Larger change, would require rewriting
  the 15 existing routes' query style. Not justified by the problem being solved.
